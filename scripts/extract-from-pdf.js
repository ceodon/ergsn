#!/usr/bin/env node
/**
 * extract-from-pdf.js — turn a maker's catalog / spec PDF into a ready-to-paste
 * data/products.json row via Claude (Anthropic SDK).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/extract-from-pdf.js <pdf-path> [--sector k-security]
 *   npm run extract:pdf -- path/to/spec.pdf
 *
 * The script reads the PDF, hands it to Claude with the products.schema.json
 * as context, and asks for a single valid JSON object matching the schema.
 * The first `--sector` CLI flag (or env ERGSN_SECTOR) biases the extraction.
 *
 * Prompt caching is applied to the schema + instruction block so repeated
 * runs across many PDFs reuse the cached portion — cheaper + faster batches.
 *
 * Output: prints the JSON object to stdout. Append it to
 * data/products.json's "products" array by hand, or pipe into `jq` for
 * automation. Always review before committing — Claude is good, not perfect.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
} catch (_) {
  console.error('✗ @anthropic-ai/sdk not installed. Run `npm install` from the repo root first.');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'data', 'products.schema.json');
const MODEL = 'claude-sonnet-4-6';

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { pdf: null, sector: process.env.ERGSN_SECTOR || '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sector') { out.sector = argv[++i] || ''; continue; }
    if (a.startsWith('--sector=')) { out.sector = a.slice(9); continue; }
    if (!a.startsWith('--') && !out.pdf) { out.pdf = a; continue; }
  }
  if (!out.pdf) {
    console.error('Usage: node scripts/extract-from-pdf.js <pdf-path> [--sector k-security]');
    process.exit(1);
  }
  out.pdf = path.resolve(out.pdf);
  if (!fs.existsSync(out.pdf)) {
    console.error(`✗ PDF not found: ${out.pdf}`);
    process.exit(1);
  }
  return out;
}

function loadSchema() {
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY env var is required. Get one at https://console.anthropic.com/');
    process.exit(1);
  }

  const { pdf, sector } = parseArgs();
  const pdfBytes = fs.readFileSync(pdf);
  const pdfBase64 = pdfBytes.toString('base64');
  const schema = loadSchema();

  const client = new Anthropic();

  const instruction =
    'You convert a Korean manufacturer\'s product spec document into one ERGSN catalog row in strict JSON. ' +
    'Output ONLY the JSON object — no prose before, no code fences, no trailing commentary. ' +
    'The JSON must satisfy data/products.schema.json.\n\n' +
    'Rules:\n' +
    '- `id` must be a stable lowercase slug derived from model+part (e.g. "dl-16xd", "keoa").\n' +
    '- `specs` is an array of [label, value] tuples — pull 6–14 most useful spec lines.\n' +
    '- `features` is an array of 6–10 concise value propositions written for a B2B buyer.\n' +
    '- `desc` is a 3–5 sentence paragraph suitable for the product modal.\n' +
    '- Keep technical terminology in English (HIPAA, GSA, KFDA, HACCP, HS code, kW/h, FPM, etc.).\n' +
    '- Preserve units, measurements, and part numbers exactly as written in the PDF.\n' +
    '- If a required field is not inferrable from the PDF, use a sensible placeholder and add a trailing "(TBD)" marker.\n' +
    '- Do not invent certifications the PDF doesn\'t claim.\n' +
    (sector ? `- Default sector when ambiguous: "${sector}".\n` : '');

  console.error(`• PDF:    ${path.relative(ROOT, pdf)}`);
  console.error(`• Size:   ${(pdfBytes.length / 1024).toFixed(1)} KB`);
  console.error(`• Model:  ${MODEL}`);
  if (sector) console.error(`• Sector: ${sector}`);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: 'You are an expert Korean-to-global trade data wrangler converting maker docs into ERGSN catalog JSON.'
      },
      /* Cache the schema + instruction — they are identical across every
         PDF in a batch run, so Anthropic returns the cached prefix billed
         at 10% of input cost. Big win when processing 50+ makers at once. */
      {
        type: 'text',
        text: 'JSON schema (products.schema.json):\n\n' + schema + '\n\nInstructions:\n\n' + instruction,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
          },
          {
            type: 'text',
            text: 'Return the single JSON object now.'
          }
        ]
      }
    ]
  });

  const text = resp.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  /* Strip accidental code fences / prose — keep only the outermost JSON. */
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('✗ Claude did not return valid JSON. Raw response:\n' + text);
    process.exit(1);
  }
  const json = JSON.parse(match[0]);

  console.error('• Cache:  created=' + (resp.usage.cache_creation_input_tokens || 0) +
                ' read=' + (resp.usage.cache_read_input_tokens || 0) +
                ' input=' + resp.usage.input_tokens +
                ' output=' + resp.usage.output_tokens);
  console.log(JSON.stringify(json, null, 2));
}

main().catch(e => {
  console.error('✗ extract-from-pdf failed:', e.message || e);
  process.exit(1);
});
