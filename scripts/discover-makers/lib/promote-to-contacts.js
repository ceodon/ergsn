'use strict';

/**
 * Promote a maker-directory entry into data/maker-contacts.json — the
 * verified-onboarded contact registry that the trade desk uses for
 * outreach + partner contracts. Mirrors the shape that already lives
 * in maker-contacts.json (cosmedique entry as the schema reference).
 *
 * Idempotent: re-promoting an already-present entry just refreshes
 * the contact / address / social fields and updates lastSyncedAt;
 * never destroys human-typed fields.
 *
 * Triggered by:
 *   - contractSigned toggled to true on a maker card
 *   - explicit POST /api/makers/:id/promote (manual button)
 */

const fs = require('fs');
const path = require('path');
const productsStore = require('./products-store');

const FILE = path.resolve(__dirname, '..', '..', '..', 'data', 'maker-contacts.json');

function read() {
  if (!fs.existsSync(FILE)) {
    return { _doc: '', makers: [] };
  }
  const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(obj.makers)) obj.makers = [];
  return obj;
}

function write(obj) {
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2) + '\n');
}

/**
 * Fold an existing contacts row with a freshly-built one — preserve any
 * non-empty existing field, otherwise take the new value.
 */
function fold(existing, incoming) {
  if (!existing) return incoming;
  const out = { ...existing };
  const fillIfBlank = (k) => { if (!out[k] && incoming[k]) out[k] = incoming[k]; };
  ['legalName', 'sector', 'moq', 'businessHours', 'registeredAt', 'registeredBy'].forEach(fillIfBlank);
  // brands / sourceUrls / productsRegistered: union dedup
  out.brands = Array.from(new Set([...(existing.brands || []), ...(incoming.brands || [])])).filter(Boolean);
  out.sourceUrls = Array.from(new Set([...(existing.sourceUrls || []), ...(incoming.sourceUrls || [])])).filter(Boolean);
  out.productsRegistered = Array.from(new Set([...(existing.productsRegistered || []), ...(incoming.productsRegistered || [])]));
  // contact / addresses / social: existing non-empty wins, else incoming
  const mergeDict = (k) => {
    const ex = existing[k] || {};
    const inc = incoming[k] || {};
    const merged = {};
    for (const key of new Set([...Object.keys(ex), ...Object.keys(inc)])) {
      const ev = (ex[key] || '').toString().trim();
      merged[key] = ev || inc[key] || '';
    }
    out[k] = merged;
  };
  mergeDict('contact');
  mergeDict('addresses');
  mergeDict('social');
  out.lastSyncedAt = new Date().toISOString().slice(0, 10);
  return out;
}

function buildContactsRow(maker) {
  const today = new Date().toISOString().slice(0, 10);
  const sourceUrls = [
    maker.englishHomepageUrl,
    maker.koreanHomepageUrl,
    maker.contactPageUrl
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  // Find live products this maker has registered
  const registered = productsStore.listForMaker(maker);
  const productsRegistered = registered.map(p => p.id);

  const addresses = {};
  if (maker.headquartersAddress) addresses.headquarter = maker.headquartersAddress;
  if (maker.factoryAddress) addresses.factory = maker.factoryAddress;

  return {
    id: maker.id,
    legalName: maker.legalName || maker.displayName || maker.homepageHost,
    brands: [],
    sourceUrls,
    productsRegistered,
    sector: maker.sector,
    moq: '',
    contact: { ...(maker.contact || {}) },
    addresses,
    social: { ...(maker.social || {}) },
    businessHours: maker.businessHours || '',
    registeredAt: today,
    registeredBy: 'review-ui (auto-promote)',
    contractSigned: !!maker.contractSigned,
    contractDate: maker.contractDate || ''
  };
}

/**
 * Promote one maker into maker-contacts.json. Returns
 * { row, action: 'created' | 'updated' }.
 */
function promote(maker) {
  const obj = read();
  const idx = obj.makers.findIndex(m => m.id === maker.id || m.id === maker.legalName);
  const fresh = buildContactsRow(maker);
  let action;
  if (idx >= 0) {
    obj.makers[idx] = fold(obj.makers[idx], fresh);
    action = 'updated';
  } else {
    obj.makers.push(fresh);
    action = 'created';
  }
  write(obj);
  return { row: idx >= 0 ? obj.makers[idx] : fresh, action };
}

function isPromoted(makerId) {
  return read().makers.some(m => m.id === makerId);
}

module.exports = { promote, isPromoted, read, FILE };
