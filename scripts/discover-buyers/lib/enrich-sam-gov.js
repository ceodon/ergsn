'use strict';

/**
 * SAM.gov entity-search enrichment.
 *
 * SAM.gov is the US federal contractor / vendor registry. Free public
 * lookup at https://api.sam.gov/entity-information/v3/entities (rate-
 * limited; requires a free SAM_GOV_API_KEY for higher quotas, but the
 * unauthenticated endpoint works for 10 requests/min/IP for casual use).
 *
 * What we pull:
 *   - legal business name (authoritative)
 *   - registry status (Active / Inactive)
 *   - CAGE code (5-char NATO commercial identifier)
 *   - DUNS / UEI
 *   - NAICS primary code (industry classifier)
 *   - registration date
 *   - physical address
 *
 * Used opportunistically: only auto-runs when the buyer is US +
 * (buyerType=fed-procurement OR sector ∈ {k-security, k-energy, k-bio,
 * k-tech}). Failure is silent — the buyer entry just doesn't get the
 * `samGov` block.
 *
 * Set SAM_GOV_API_KEY in .env to lift rate limits (https://sam.gov/
 * data-services → Get an API key, free).
 */

const ENDPOINT = 'https://api.sam.gov/entity-information/v3/entities';

async function lookupSamGov(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return null;

  const params = new URLSearchParams({
    api_key: process.env.SAM_GOV_API_KEY || 'DEMO_KEY',
    q: trimmed,
    registrationStatus: 'A',
    samRegistered: 'Yes',
    pageSize: '1'
  });

  let res;
  try {
    res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { 'User-Agent': 'ERGSN-buyer-research/1.0 (+https://ergsn.net)', 'Accept': 'application/json' }
    });
  } catch (e) {
    return { matched: false, error: 'fetch failed: ' + e.message };
  }
  if (!res.ok) return { matched: false, error: `SAM.gov ${res.status}` };

  let data;
  try { data = await res.json(); } catch { return { matched: false, error: 'bad json' }; }

  const list = (data && data.entityData) || [];
  if (!list.length) return { matched: false, source: 'sam.gov' };
  const e = list[0];
  const core = (e.entityRegistration) || {};
  const integ = (e.coreData && e.coreData.entityInformation) || {};
  const addr = (e.coreData && e.coreData.physicalAddress) || {};
  const naicsList = (e.assertions && e.assertions.goodsAndServices && e.assertions.goodsAndServices.primaryNaics) ? [e.assertions.goodsAndServices.primaryNaics] : [];
  return {
    matched: true,
    legalBusinessName: core.legalBusinessName || '',
    registrationStatus: core.registrationStatus || '',
    cageCode: core.cageCode || '',
    ueiSAM: core.ueiSAM || '',
    duns: core.duns || '',
    naicsPrimary: naicsList.join(','),
    initialRegistrationDate: integ.entityCreationDate || core.initialRegistrationDate || '',
    physicalAddress: [addr.addressLine1, addr.city, addr.stateOrProvinceCode, addr.zipCode].filter(Boolean).join(', '),
    source: 'sam.gov',
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { lookupSamGov };
