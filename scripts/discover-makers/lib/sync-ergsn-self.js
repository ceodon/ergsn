'use strict';

/**
 * One-shot sync for owner-known makers whose products live in the inline
 * index.html catalog (not data/products.json), so sync-from-products can't
 * see them.
 *
 *   ERGSN CO., LTD. — owner brand · K-Security (DL Series), K-Tech, K-Energy (HYGEN)
 *   MICROBE         — co-maker for K-Bio Rosetta Plus
 *
 * Each entry is hand-seeded once; the review UI then manages it like any
 * other onboarded maker. Idempotent — runs on every server boot.
 */

const persistence = require('./persistence');

const OWNED_MAKERS = [
  {
    id: 'mfg-ergsn-k-security',
    legalName: 'ERGSN CO., LTD.',
    displayName: 'ERGSN · K-Security',
    sector: 'k-security',
    homepageHost: 'ergsn.net',
    summary: 'DL Series shredders · 6 models (DL-10X / DL-16X / DL-10XD / DL-16XD …)'
  },
  {
    id: 'mfg-ergsn-k-tech',
    legalName: 'ERGSN CO., LTD.',
    displayName: 'ERGSN · K-Tech',
    sector: 'k-tech',
    homepageHost: 'ergsn.net',
    summary: '2D → 3D stereoscopic conversion'
  },
  {
    id: 'mfg-ergsn-k-energy',
    legalName: 'ERGSN CO., LTD.',
    displayName: 'ERGSN · K-Energy',
    sector: 'k-energy',
    homepageHost: 'ergsn.net',
    summary: 'HYGEN Generator · 4 configurations'
  },
  {
    id: 'mfg-microbe-k-bio',
    legalName: 'MICROBE',
    displayName: 'MICROBE · K-Bio',
    sector: 'k-bio',
    homepageHost: '',
    summary: 'Rosetta Plus HFF (manufacturer) — co-product with ERGSN'
  }
];

function entryFor(seed) {
  const today = new Date().toISOString().slice(0, 10);
  const isErgsn = seed.legalName === 'ERGSN CO., LTD.';
  return {
    id: seed.id,
    legalName: seed.legalName,
    displayName: seed.displayName,
    sector: seed.sector,
    homepageHost: seed.homepageHost,
    koreanHomepageUrl: isErgsn ? 'https://ergsn.net/?sector=' + seed.sector : '',
    englishHomepageUrl: isErgsn ? 'https://ergsn.net/?sector=' + seed.sector : '',
    englishDetectedBy: 'manual',
    headquartersCountry: 'KR',
    headquartersAddress: '',
    businessType: 'manufacturer',
    exportSignals: [],
    structuredDataHints: { jsonLdTypes: [], ogSiteName: seed.legalName, metaDescription: seed.summary, htmlLangAttr: 'en' },
    contact: {},
    social: {},
    sources: [{ seed: 'owner-known', seedQuery: seed.legalName, discoveredAt: today }],
    status: 'onboarded',
    contractSigned: true,
    contractDate: today,
    discoveredAt: today,
    lastFetchedAt: new Date().toISOString(),
    notes: seed.summary + ' · inline catalog on index.html (not in data/products.json).'
  };
}

function syncErgsnSelf() {
  const obj = persistence.read();
  const byId = new Map(obj.makers.map(m => [m.id, m]));
  let added = 0;
  for (const seed of OWNED_MAKERS) {
    if (byId.has(seed.id)) continue;
    obj.makers.push(entryFor(seed));
    added += 1;
  }
  if (added > 0) persistence.write(obj);
  return { added, total: obj.makers.length };
}

module.exports = { syncErgsnSelf };
