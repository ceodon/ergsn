'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'maker-directory.json');

function read() {
  if (!fs.existsSync(FILE)) {
    return { _doc: '', _schema: 'data/maker-directory.schema.json', makers: [] };
  }
  const raw = fs.readFileSync(FILE, 'utf8');
  const obj = JSON.parse(raw);
  if (!Array.isArray(obj.makers)) obj.makers = [];
  return obj;
}

function write(obj) {
  const sorted = { ...obj, makers: [...obj.makers].sort((a, b) => a.id.localeCompare(b.id)) };
  fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n');
}

/**
 * Merge a freshly-discovered entry into the existing list.
 *  - dedup by host (case-insensitive)
 *  - if already present, append to .sources, refresh lastFetchedAt, fill blanks
 *  - never overwrite a manually-edited field (status, notes, sector when not 'uncategorised', etc.)
 */
function merge(existing, incoming) {
  if (!existing) return incoming;
  const out = { ...existing };

  // Append source provenance (dedup on seed+seedQuery+date)
  const known = new Set(existing.sources.map(s => `${s.seed}|${s.seedQuery || ''}|${s.discoveredAt}`));
  for (const src of incoming.sources || []) {
    const k = `${src.seed}|${src.seedQuery || ''}|${src.discoveredAt}`;
    if (!known.has(k)) out.sources.push(src);
  }

  // Fill blanks — never overwrite non-empty strings on the existing record
  const fillIfBlank = (k) => {
    if (!out[k] && incoming[k]) out[k] = incoming[k];
  };
  ['legalName', 'displayName', 'koreanHomepageUrl', 'englishHomepageUrl', 'englishDetectedBy',
    'headquartersAddress', 'headquartersCity', 'headquartersCountry',
    'factoryAddress', 'businessHours', 'contactPageUrl',
    'subCategory', 'notes'].forEach(fillIfBlank);

  // businessType: treat 'unclear' as a blank so a real classification overrides it
  if ((!out.businessType || out.businessType === 'unclear')
      && incoming.businessType && incoming.businessType !== 'unclear') {
    out.businessType = incoming.businessType;
  }

  // sector: treat 'uncategorised' as a blank
  if (out.sector === 'uncategorised' && incoming.sector && incoming.sector !== 'uncategorised') {
    out.sector = incoming.sector;
  }

  // Always refresh fetch timestamp + structured hints (latest snapshot wins)
  if (incoming.lastFetchedAt) out.lastFetchedAt = incoming.lastFetchedAt;
  if (incoming.structuredDataHints) out.structuredDataHints = incoming.structuredDataHints;

  // Contact / social — applyEnrichment in lib/llm-extract.js already runs
  // validators on every key, so its result is the source of truth when present.
  // Only fall back to existing when the caller didn't supply a contact dict
  // (e.g. seed mode without enrichment).
  out.contact = incoming.contact ? incoming.contact : (existing.contact || {});
  if (incoming.social || existing.social) {
    out.social = incoming.social ? incoming.social : (existing.social || {});
  }

  // Export signals: dedup union
  const sigs = new Set([...(existing.exportSignals || []), ...(incoming.exportSignals || [])]);
  out.exportSignals = Array.from(sigs);

  return out;
}

function upsertMany(entries) {
  const obj = read();
  const byId = new Map(obj.makers.map(m => [m.id, m]));
  let added = 0, updated = 0;
  for (const e of entries) {
    if (!e || !e.id) continue;
    const existing = byId.get(e.id);
    const merged = merge(existing, e);
    byId.set(e.id, merged);
    if (existing) updated += 1; else added += 1;
  }
  obj.makers = Array.from(byId.values());
  write(obj);
  return { added, updated, total: obj.makers.length };
}

module.exports = { read, write, merge, upsertMany, FILE };
