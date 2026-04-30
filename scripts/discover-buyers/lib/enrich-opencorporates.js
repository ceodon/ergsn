'use strict';

/**
 * OpenCorporates registry-search enrichment.
 *
 * OpenCorporates aggregates company registries across 130+ jurisdictions.
 * Free no-auth tier: 50 requests/day, basic fields only. Set
 * OPENCORPORATES_API_TOKEN in .env to lift the limit (free signup at
 * opencorporates.com).
 *
 * What we pull (best-effort):
 *   - confirmed legal name from official registry
 *   - jurisdiction code (us_de, us_ny, gb, kr, jp, ...)
 *   - registry-listed status (Active / Dissolved / etc.)
 *   - registered office address
 *   - incorporation date
 *
 * Used as a side-channel cross-check on whatever the LLM extracted.
 * Failure is silent.
 */

const ENDPOINT = 'https://api.opencorporates.com/v0.4/companies/search';

const COUNTRY_TO_JURIS = {
  US: 'us', GB: 'gb', KR: 'kr', JP: 'jp', DE: 'de', FR: 'fr', AU: 'au',
  CA: 'ca', SG: 'sg', NL: 'nl', SE: 'se', CH: 'ch', AT: 'at', IT: 'it',
  ES: 'es', BE: 'be', IE: 'ie', NZ: 'nz', HK: 'hk', TW: 'tw', IN: 'in'
};

async function lookupOpenCorporates({ name, country } = {}) {
  if (!name || typeof name !== 'string') return null;
  const q = name.trim().slice(0, 120);
  if (!q) return null;

  const params = new URLSearchParams({ q, per_page: '1', order: 'score' });
  if (country) {
    const j = COUNTRY_TO_JURIS[country.toUpperCase()];
    if (j) params.set('country_code', j);
  }
  if (process.env.OPENCORPORATES_API_TOKEN) params.set('api_token', process.env.OPENCORPORATES_API_TOKEN);

  let res;
  try {
    res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': 'ERGSN-buyer-research/1.0 (+https://ergsn.net)', 'Accept': 'application/json' }
    });
  } catch (e) {
    return { matched: false, error: 'fetch failed: ' + e.message };
  }
  if (!res.ok) {
    // 401 = needs token at this volume; 429 = rate-limited. Both silent.
    return { matched: false, error: `OpenCorporates ${res.status}` };
  }
  let data;
  try { data = await res.json(); } catch { return { matched: false, error: 'bad json' }; }

  const items = (data && data.results && Array.isArray(data.results.companies)) ? data.results.companies : [];
  if (!items.length) return { matched: false, source: 'opencorporates' };
  const c = items[0].company || {};
  return {
    matched: true,
    confirmedLegalName: c.name || '',
    jurisdiction: c.jurisdiction_code || '',
    companyNumber: c.company_number || '',
    registryStatus: c.current_status || '',
    incorporationDate: c.incorporation_date || '',
    registeredAddress: c.registered_address_in_full || '',
    openCorporatesUrl: c.opencorporates_url || '',
    source: 'opencorporates',
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { lookupOpenCorporates };
