'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'buyer-directory.json');

function read() {
  if (!fs.existsSync(FILE)) {
    return {
      _doc: 'ERGSN buyer directory — vetted procurement / importer leads.',
      _schema: 'data/buyer-directory.schema.json',
      buyers: []
    };
  }
  const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(obj.buyers)) obj.buyers = [];
  return obj;
}

function write(obj) {
  const sorted = { ...obj, buyers: [...obj.buyers].sort((a, b) => a.id.localeCompare(b.id)) };
  fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n');
}

/** Add new entries; for collisions on `id`, refresh discovered timestamps but
 *  keep human-set status / notes / contact intact. */
function upsertMany(entries) {
  const obj = read();
  const byId = new Map(obj.buyers.map(b => [b.id, b]));
  let added = 0, updated = 0;
  for (const e of entries) {
    if (!e || !e.id) continue;
    const existing = byId.get(e.id);
    if (existing) {
      const out = { ...existing };
      // Refresh discovery-side fields, never touch human-set ones
      if (e.lastVerifiedAt) out.lastVerifiedAt = e.lastVerifiedAt;
      // Preserve user-set status; only fill if existing was absent
      if (!out.status && e.status) out.status = e.status;
      // Append new sources without dups
      const existingSeeds = new Set((out.sources || []).map(s => s.seed + '|' + (s.seedQuery || '')));
      for (const s of (e.sources || [])) {
        const k = s.seed + '|' + (s.seedQuery || '');
        if (!existingSeeds.has(k)) (out.sources = out.sources || []).push(s);
      }
      byId.set(e.id, out);
      updated += 1;
    } else {
      byId.set(e.id, e);
      added += 1;
    }
  }
  obj.buyers = Array.from(byId.values());
  write(obj);
  return { added, updated, total: obj.buyers.length };
}

module.exports = { read, write, upsertMany, FILE };
