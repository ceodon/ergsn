#!/usr/bin/env node
'use strict';

/**
 * compose.js — generates a personalized cold-mail draft per buyer and
 * writes the result to data/buyer-outbox/<buyerId>.json. NEVER sends.
 *
 * Usage:
 *   node scripts/discover-buyers/compose.js --buyer=shredder-warehouse-com
 *   node scripts/discover-buyers/compose.js --sector=k-security --max=5
 *   node scripts/discover-buyers/compose.js --status=verified --max=10
 *   node scripts/discover-buyers/compose.js --refresh  (re-compose existing drafts)
 *
 * Buyers selected for composition must have:
 *   - status in ['verified', 'queued']  (or human override via --buyer=ID)
 *   - non-empty contact.primaryEmail OR contact.procurementEmail
 *   - sector with a SECTOR_PITCH entry
 *
 * Output: data/buyer-outbox/<buyerId>.json
 */

require('../discover-makers/lib/dotenv').loadDotEnv();

const fs = require('fs');
const path = require('path');
const persistence = require('./lib/persistence');
const { composeMail } = require('./lib/compose-mail');

const OUTBOX_DIR = path.resolve(__dirname, '..', '..', 'data', 'buyer-outbox');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function ensureOutboxDir() {
  if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

function pickTargets(args, all) {
  if (args.buyer) return all.filter(b => b.id === args.buyer);
  let pool = all;
  if (args.sector) pool = pool.filter(b => b.sector === args.sector);
  if (args.status) pool = pool.filter(b => b.status === args.status);
  else pool = pool.filter(b => b.status === 'verified' || b.status === 'queued');
  // Need an email to send to
  pool = pool.filter(b => (b.contact && (b.contact.procurementEmail || b.contact.primaryEmail)));
  // Skip already-drafted unless --refresh
  if (!args.refresh) {
    pool = pool.filter(b => !fs.existsSync(path.join(OUTBOX_DIR, `${b.id}.json`)));
  }
  const max = args.max && Number(args.max) > 0 ? Number(args.max) : 25;
  return pool.slice(0, max);
}

async function main() {
  const args = parseArgs(process.argv);
  ensureOutboxDir();

  const all = persistence.read().buyers;
  const targets = pickTargets(args, all);
  console.log(`compose-mail: ${targets.length} buyer(s) selected${args.refresh ? ' (refresh mode)' : ''}`);

  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i += 1) {
    const b = targets[i];
    try {
      const draft = await composeMail(b);
      const outPath = path.join(OUTBOX_DIR, `${b.id}.json`);
      fs.writeFileSync(outPath, JSON.stringify(draft, null, 2) + '\n');
      ok += 1;
      console.log(`  [${String(i+1).padStart(2)}/${targets.length}] DRAFT  ${b.id}  →  ${draft.toEmail}  ·  "${draft.subject}"`);
    } catch (e) {
      fail += 1;
      console.log(`  [${String(i+1).padStart(2)}/${targets.length}] FAIL   ${b.id}  ·  ${e.message}`);
    }
  }
  console.log(`\nsummary: ${ok} drafts written · ${fail} failed · outbox=${OUTBOX_DIR}`);
}

main().catch(err => { console.error(`error: ${err.message || err}`); process.exit(1); });
