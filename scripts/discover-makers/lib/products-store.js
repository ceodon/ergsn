'use strict';

/**
 * Read/write helper for data/products.json — the live ERGSN catalog that
 * `npm run build:products` consumes. Distinct from product-candidates.json
 * (the discovery pool); this one is the source of truth for the live site.
 *
 * Kept tiny so the review-server can integrate registered + candidate views
 * without bringing in a heavy ORM or schema validator.
 *
 * Schema reference: data/products.schema.json (managed by hand for now).
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'products.json');

function read() {
  if (!fs.existsSync(FILE)) {
    return { _doc: '', products: [] };
  }
  const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(obj.products)) obj.products = [];
  return obj;
}

function write(obj) {
  // Preserve any non-products top-level fields (the human-edited _doc, etc.)
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2) + '\n');
}

/**
 * List products for a given maker. We match on legalName (canonical) and
 * displayName (fallback), case-insensitively. The maker.id from the
 * maker-directory is the unambiguous key, so we also check that against
 * any product.makerId field that may have been set during a register call.
 */
function listForMaker(maker) {
  const obj = read();
  const targets = new Set();
  if (maker.id) targets.add(maker.id);
  if (maker.legalName) targets.add(normalise(maker.legalName));
  if (maker.displayName) targets.add(normalise(maker.displayName));
  return obj.products.filter(p => {
    if (p.makerId && targets.has(p.makerId)) return true;
    if (p.maker && targets.has(normalise(p.maker))) return true;
    return false;
  });
}

function normalise(s) {
  return String(s || '').trim().toLowerCase().replace(/[\s.,]+/g, ' ');
}

function byProductId(id) {
  return read().products.find(p => p.id === id) || null;
}

/** Insert one product; product.id must be unique. Returns updated count. */
function add(product) {
  const obj = read();
  if (obj.products.find(p => p.id === product.id)) {
    throw new Error(`product id "${product.id}" already exists in data/products.json`);
  }
  obj.products.push(product);
  write(obj);
  return obj.products.length;
}

/** Remove one product by id. Returns true if it existed. */
function remove(id) {
  const obj = read();
  const idx = obj.products.findIndex(p => p.id === id);
  if (idx === -1) return false;
  obj.products.splice(idx, 1);
  write(obj);
  return true;
}

/** Distinct maker strings present in products.json — used to seed maker-directory. */
function distinctMakers() {
  const obj = read();
  const m = new Map();   // legalName → first product seen for sector hint
  for (const p of obj.products) {
    if (!p.maker || /^ergsn\s*\(placeholder\)$/i.test(p.maker)) continue;
    if (!m.has(p.maker)) m.set(p.maker, p);
  }
  return Array.from(m.entries()).map(([legalName, sample]) => ({
    legalName,
    sectorHint: sample.sector || 'uncategorised'
  }));
}

module.exports = { read, write, listForMaker, byProductId, add, remove, distinctMakers, FILE };
