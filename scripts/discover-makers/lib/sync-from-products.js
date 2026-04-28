'use strict';

/**
 * One-shot sync that promotes makers referenced in data/products.json into
 * data/maker-directory.json so the review UI shows them alongside discovered
 * makers. Idempotent — runs on every review-server boot.
 *
 * Default state for synced entries:
 *   status:         'onboarded'    (they already have live products)
 *   contractSigned: false          (user toggles this in the UI)
 *   sources:        [{ seed: 'products.json', date }]
 *
 * The slug is derived from legalName (lowercase + dash) so it stays stable
 * across boots without colliding with the discovered makers' host-based slugs.
 */

const productsStore = require('./products-store');
const persistence = require('./persistence');

function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function syncFromProducts() {
  const distinct = productsStore.distinctMakers();
  if (distinct.length === 0) return { added: 0, skipped: 0, total: 0 };
  const obj = persistence.read();
  const byId = new Map(obj.makers.map(m => [m.id, m]));
  const byLegal = new Map(obj.makers.map(m => [(m.legalName || '').toLowerCase(), m]));

  let added = 0, skipped = 0;
  for (const { legalName, sectorHint } of distinct) {
    // Already present under either an existing slug OR a discovered host slug
    if (byLegal.has(legalName.toLowerCase())) { skipped += 1; continue; }
    const id = 'mfg-' + slug(legalName);
    if (byId.has(id)) { skipped += 1; continue; }
    obj.makers.push({
      id,
      legalName,
      displayName: legalName,
      sector: sectorHint,
      homepageHost: '',
      koreanHomepageUrl: '',
      englishHomepageUrl: '',
      englishDetectedBy: 'manual',
      headquartersCountry: 'KR',
      headquartersAddress: '',
      businessType: 'manufacturer',
      exportSignals: [],
      structuredDataHints: { jsonLdTypes: [], ogSiteName: '', metaDescription: '', htmlLangAttr: '' },
      contact: {},
      sources: [{ seed: 'products.json', seedQuery: 'sync', discoveredAt: new Date().toISOString().slice(0, 10) }],
      status: 'onboarded',
      discoveredAt: new Date().toISOString().slice(0, 10),
      lastFetchedAt: new Date().toISOString()
    });
    added += 1;
  }
  if (added > 0) persistence.write(obj);
  return { added, skipped, total: obj.makers.length };
}

module.exports = { syncFromProducts };
