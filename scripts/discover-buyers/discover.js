#!/usr/bin/env node
'use strict';

/**
 * discover-buyers — entry point for buyer-side discovery.
 *
 * Modes (mirror discover-makers):
 *   1. Seed mode (default) — fetch candidate URLs from a seed plugin,
 *      verify, persist new entries.
 *
 *      node scripts/discover-buyers/discover.js --seed=search --sector=k-security
 *      node scripts/discover-buyers/discover.js --seed=search --all-sectors
 *      node scripts/discover-buyers/discover.js --seed=search --sector=k-security --dry-run
 *
 * Common flags:
 *   --seed         seed plugin name (search) — search needs TAVILY_API_KEY in .env
 *   --sector       ERGSN sector slug
 *   --all-sectors  iterate every sector with defined buyer queries
 *   --dry-run      do not write back to data/buyer-directory.json
 */

require('../discover-makers/lib/dotenv').loadDotEnv();

const { verifyAll } = require('./verify');
const persistence = require('./lib/persistence');
const searchSeed = require('./seeds/search');
const csvSeed = require('./seeds/csv');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

async function loadSeed(name, { sector, allSectors, csvPath }) {
  switch (name) {
    case 'search':
      return allSectors ? await searchSeed.loadAll() : await searchSeed.load(sector);
    case 'csv':
      return csvSeed.load({ csvPath, sector: allSectors ? null : sector });
    default:
      throw new Error(`Unknown seed "${name}". Available: search, csv`);
  }
}

function logProgress({ i, total, candidate, result }) {
  const tag = result.ok
    ? `${result.entry.status.toUpperCase()}(${result.entry.buyerType})`
    : `FAIL(${result.reason})`;
  // eslint-disable-next-line no-console
  console.log(`  [${String(i).padStart(2)}/${total}] ${tag.padEnd(28)} ${candidate.url}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const seedName = args.seed || 'search';
  const sector = args.sector;
  const allSectors = Boolean(args['all-sectors']);
  const dryRun = Boolean(args['dry-run']);
  const csvPath = args.csv || null;

  // CSV seed allows running without a sector flag (CSV rows carry sector
  // per row). Search seed requires --sector or --all-sectors.
  if (seedName !== 'csv' && !sector && !allSectors) {
    console.error('error: --sector or --all-sectors is required for seed=' + seedName);
    console.error(`available sectors for buyer search: ${searchSeed.availableSectors().join(', ')}`);
    process.exit(1);
  }

  let candidates = await loadSeed(seedName, { sector, allSectors, csvPath });

  // Cap — even with --all-sectors a sweep can surface 1,000+ candidates
  // (9 sectors × 8-12 queries × up to 20 results). Each verify is
  // 5-30 seconds, so an unbounded run takes hours. --max defaults to 200
  // for buyer side; user passes --max=10000 to override.
  const maxArg = args.max ? Number(args.max) : 200;
  if (Number.isFinite(maxArg) && maxArg > 0 && candidates.length > maxArg) {
    console.log(`(capping ${candidates.length} candidates → ${maxArg} via --max=${maxArg}; pass a larger --max to sweep more)`);
    candidates = candidates.slice(0, maxArg);
  }

  const scope = seedName === 'csv'
    ? (sector ? `csv sector=${sector}` : 'csv all-rows')
    : (allSectors ? `all-sectors (${searchSeed.availableSectors().length})` : `sector=${sector}`);
  console.log(`discover-buyers: seed=${seedName} ${scope} candidates=${candidates.length}${dryRun ? ' (dry-run)' : ''}`);

  // Incremental persist hook — each successful verify lands in
  // data/buyer-directory.json IMMEDIATELY so the UI sees results trickling
  // in real time, and an interrupted batch never loses verified entries.
  let persistedCount = 0;
  const onEntry = dryRun ? null : (entry) => {
    const stats = persistence.upsertMany([entry]);
    persistedCount += stats.added + stats.updated;
  };

  const { entries, reports } = await verifyAll(candidates, { onProgress: logProgress, onEntry });

  const okCount = reports.filter(r => r.ok).length;
  const verifiedCount = reports.filter(r => r.ok && r.entry.status === 'verified').length;
  const failCount = reports.filter(r => !r.ok).length;

  if (!dryRun) {
    console.log(`\npersisted: ${persistedCount} entries written incrementally → ${persistence.read().buyers.length} total in ${persistence.FILE}`);
  }
  console.log(`\nsummary: ${okCount} fetched · ${verifiedCount} verified (auto) · ${failCount} failed`);
}

main().catch(err => {
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
