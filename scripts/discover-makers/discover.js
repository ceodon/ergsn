#!/usr/bin/env node
'use strict';

/**
 * discover.js — entry point for the maker-discovery pipeline.
 *
 * Two modes:
 *
 * 1. Seed mode (default) — fetch candidate URLs from a seed plugin, verify,
 *    persist new entries.
 *
 *    node scripts/discover-makers/discover.js --seed=manual --sector=k-beauty
 *    node scripts/discover-makers/discover.js --seed=manual --all-sectors
 *    node scripts/discover-makers/discover.js --seed=search --sector=k-culture-goods
 *    node scripts/discover-makers/discover.js --seed=search --all-sectors
 *    node scripts/discover-makers/discover.js --seed=manual --sector=k-beauty --dry-run
 *
 * 2. Enrich mode — pick existing entries that have empty fields, re-fetch
 *    the homepage, ask Claude Haiku 4.5 to extract structured fields, and
 *    merge back into data/maker-directory.json.
 *
 *    node scripts/discover-makers/discover.js --enrich --sector=k-beauty
 *    node scripts/discover-makers/discover.js --enrich --all-sectors
 *    node scripts/discover-makers/discover.js --enrich --all-sectors --max=10 --dry-run
 *
 * Common flags:
 *   --seed         seed plugin name (manual | search) — search needs BRAVE_API_KEY in .env
 *   --sector       ERGSN sector slug
 *   --all-sectors  iterate every sector (mutually exclusive with --sector)
 *   --dry-run      do not write back to data/maker-directory.json
 *
 * Enrich-only flags:
 *   --enrich       enable enrich mode (no fetch from seeds)
 *   --max=N        cap the number of entries to enrich this run (default 50)
 *   --refresh      re-enrich even entries whose fields are already populated
 */

// Load .env first — search/enrich seeds read TAVILY_API_KEY (Tavily seed) and
// CLOUDFLARE_AI_TOKEN + CLOUDFLARE_ACCOUNT_ID (Workers AI enrich) at init.
require('./lib/dotenv').loadDotEnv();

const { verifyAll } = require('./verify');
const persistence = require('./lib/persistence');
const manualSeed = require('./seeds/manual');
const searchSeed = require('./seeds/search');
const { politeFetch } = require('./lib/fetch');
const { extractAll } = require('./lib/extract-hints');
const { rootUrl } = require('./lib/normalize');
const { enrich, applyEnrichment } = require('./lib/llm-extract');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

async function loadSeed(name, { sector, allSectors }) {
  switch (name) {
    case 'manual':
      return allSectors ? manualSeed.loadAll() : manualSeed.load(sector);
    case 'search':
      return allSectors ? await searchSeed.loadAll() : await searchSeed.load(sector);
    default:
      throw new Error(`Unknown seed "${name}". Available: manual, search`);
  }
}

function logProgress({ i, total, candidate, result }) {
  const tag = result.ok
    ? (result.hasEnglish ? `EN(${result.detectedBy})` : 'no-EN')
    : `FAIL(${result.reason})`;
  // eslint-disable-next-line no-console
  console.log(`  [${String(i).padStart(2)}/${total}] ${tag.padEnd(22)} ${candidate.url}`);
}

async function runSeedMode({ seedName, sector, allSectors, dryRun }) {
  if (!sector && !allSectors) {
    // eslint-disable-next-line no-console
    console.error('error: --sector or --all-sectors is required');
    // eslint-disable-next-line no-console
    console.error(`available sectors for seed=manual: ${manualSeed.availableSectors().join(', ')}`);
    process.exit(1);
  }
  if (sector && allSectors) {
    // eslint-disable-next-line no-console
    console.error('error: --sector and --all-sectors are mutually exclusive');
    process.exit(1);
  }

  const candidates = await loadSeed(seedName, { sector, allSectors });
  const seedAvail = (seedName === 'search' ? searchSeed : manualSeed).availableSectors();
  const scope = allSectors ? `all-sectors (${seedAvail.length})` : `sector=${sector}`;
  // eslint-disable-next-line no-console
  console.log(`discover-makers: seed=${seedName} ${scope} candidates=${candidates.length}${dryRun ? ' (dry-run)' : ''}`);

  const { entries, reports } = await verifyAll(candidates, { onProgress: logProgress });

  const okCount = reports.filter(r => r.ok).length;
  const enCount = reports.filter(r => r.ok && r.hasEnglish).length;
  const failCount = reports.filter(r => !r.ok).length;

  if (!dryRun && entries.length > 0) {
    const stats = persistence.upsertMany(entries);
    // eslint-disable-next-line no-console
    console.log(`\npersisted: +${stats.added} new, ${stats.updated} updated → ${stats.total} total in ${persistence.FILE}`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nsummary: ${okCount} fetched · ${enCount} with English homepage · ${failCount} failed`);
}

function needsEnrichment(m) {
  return !m.legalName || m.businessType === 'unclear' || !m.headquartersAddress
    || (m.exportSignals || []).length === 0;
}

async function runEnrichMode({ sector, allSectors, dryRun, max, refresh }) {
  const obj = persistence.read();
  let pool = obj.makers;
  if (sector) pool = pool.filter(m => m.sector === sector);
  if (!refresh) pool = pool.filter(needsEnrichment);

  // Prefer entries that have an English URL (cheapest signal: model can read it)
  pool.sort((a, b) => {
    const ar = a.englishHomepageUrl ? 0 : 1;
    const br = b.englishHomepageUrl ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.id.localeCompare(b.id);
  });

  const limit = max && Number(max) > 0 ? Number(max) : 50;
  const targets = pool.slice(0, limit);

  // eslint-disable-next-line no-console
  console.log(`enrich: ${targets.length} entry(ies) to process${refresh ? ' (refresh)' : ''}${dryRun ? ' (dry-run)' : ''}`);

  let okCount = 0, failCount = 0, totalInputTokens = 0, totalOutputTokens = 0, cacheReadTokens = 0;
  const updated = [];
  let i = 0;

  for (const entry of targets) {
    i += 1;
    const url = entry.englishHomepageUrl || entry.koreanHomepageUrl || `https://${entry.homepageHost}/`;
    const fetched = await politeFetch(rootUrl(url));
    if (!fetched.ok) {
      failCount += 1;
      // eslint-disable-next-line no-console
      console.log(`  [${String(i).padStart(2)}/${targets.length}] SKIP (${fetched.error || 'HTTP ' + fetched.status}) ${entry.id}`);
      continue;
    }
    const hints = extractAll(fetched.text, fetched.finalUrl);

    let result;
    try {
      result = await enrich({ url: fetched.finalUrl, hints, html: fetched.text });
    } catch (e) {
      failCount += 1;
      // eslint-disable-next-line no-console
      console.log(`  [${String(i).padStart(2)}/${targets.length}] LLM-FAIL (${e.message}) ${entry.id}`);
      continue;
    }

    if (!result.enriched) {
      failCount += 1;
      // eslint-disable-next-line no-console
      console.log(`  [${String(i).padStart(2)}/${targets.length}] BAD-JSON ${entry.id}`);
      continue;
    }

    if (result.usage) {
      totalInputTokens += (result.usage.input_tokens || 0);
      totalOutputTokens += (result.usage.output_tokens || 0);
      // Per-call AI usage line — review-server.js parses this incrementally
      // to update the daily-quota countdown without waiting for the final
      // summary line.
      // eslint-disable-next-line no-console
      console.log(`ai-call: in=${result.usage.input_tokens || 0} out=${result.usage.output_tokens || 0}`);
    } else {
      // Even without usage data, count the call so the budget reflects it.
      // eslint-disable-next-line no-console
      console.log('ai-call: in=0 out=0');
    }

    const merged = applyEnrichment(entry, result.enriched);
    updated.push(merged);
    okCount += 1;
    const e = result.enriched;
    // eslint-disable-next-line no-console
    console.log(`  [${String(i).padStart(2)}/${targets.length}] OK ${entry.id} → ${e.legalName || '(no-name)'} · ${e.businessType} · ${e.headquartersCity || '?'} · ${e.exportSignals.length} signals`);
  }

  if (!dryRun && updated.length > 0) {
    const stats = persistence.upsertMany(updated);
    // eslint-disable-next-line no-console
    console.log(`\npersisted: ${stats.updated} updated → ${stats.total} total in ${persistence.FILE}`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nsummary: ${okCount} enriched · ${failCount} failed · tokens in=${totalInputTokens} out=${totalOutputTokens}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const seedName = args.seed || 'manual';
  const sector = args.sector;
  const allSectors = Boolean(args['all-sectors']);
  const dryRun = Boolean(args['dry-run']);

  if (args.enrich) {
    await runEnrichMode({ sector, allSectors, dryRun, max: args.max, refresh: Boolean(args.refresh) });
    return;
  }

  await runSeedMode({ seedName, sector, allSectors, dryRun });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
