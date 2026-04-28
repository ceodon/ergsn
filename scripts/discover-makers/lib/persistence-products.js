'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'product-candidates.json');

function read() {
  if (!fs.existsSync(FILE)) {
    return { _doc: '', _schema: 'data/product-candidates.schema.json', products: [] };
  }
  const raw = fs.readFileSync(FILE, 'utf8');
  const obj = JSON.parse(raw);
  if (!Array.isArray(obj.products)) obj.products = [];
  return obj;
}

function write(obj) {
  const sorted = { ...obj, products: [...obj.products].sort((a, b) => (a.makerId + a.id).localeCompare(b.makerId + b.id)) };
  fs.writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n');
}

/** Dedup by id — same product (host+url hash) discovered again only refreshes lastDiscoveredAt-style fields. */
function upsertMany(entries) {
  const obj = read();
  const byId = new Map(obj.products.map(p => [p.id, p]));
  let added = 0, updated = 0;
  for (const e of entries) {
    if (!e || !e.id) continue;
    const existing = byId.get(e.id);
    if (existing) {
      // Refresh discovered fields, preserve human-set status/notes
      const out = { ...existing };
      if (existing.status === 'candidate') {
        // Re-discovery may improve metadata
        if (e.imageUrl && !out.imageUrl) out.imageUrl = e.imageUrl;
        if (e.description && !out.description) out.description = e.description;
        if (e.priceText && !out.priceText) out.priceText = e.priceText;
        if (e.moqText && !out.moqText) out.moqText = e.moqText;
      }
      out.discoveredFrom = e.discoveredFrom || out.discoveredFrom;
      byId.set(e.id, out);
      updated += 1;
    } else {
      byId.set(e.id, e);
      added += 1;
    }
  }
  obj.products = Array.from(byId.values());
  write(obj);
  return { added, updated, total: obj.products.length };
}

function patch(id, patch) {
  const obj = read();
  const p = obj.products.find(x => x.id === id);
  if (!p) return null;
  if (patch.status) p.status = patch.status;
  if (typeof patch.notes === 'string') p.notes = patch.notes.slice(0, 500);
  write(obj);
  return p;
}

function listForMaker(makerId) {
  return read().products.filter(p => p.makerId === makerId);
}

module.exports = { read, write, upsertMany, patch, listForMaker, FILE };
