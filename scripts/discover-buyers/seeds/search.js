'use strict';

/**
 * Tavily Search seed for BUYER discovery.
 *
 * Mirrors scripts/discover-makers/seeds/search.js on the maker side, but
 * the queries are flipped: we look for procurement / importer / distributor
 * / system-integrator entities likely to buy ERGSN-represented Korean
 * products, not Korean makers themselves.
 *
 * Tavily Researcher tier (1,000 credits/month free) — same key as the maker
 * side reads. RESULTS_PER_QUERY 20 (Tavily max).
 *
 * To extend: add a sector key to QUERIES with 3-6 hand-tuned queries that
 * lean on US procurement vocabulary first (federal RFP language tends to
 * surface high-quality buyers), then EU / SEA later.
 */

const ENDPOINT = 'https://api.tavily.com/search';
const RESULTS_PER_QUERY = 20;
const PER_QUERY_DELAY_MS = 600;

const HOST_BLACKLIST = new Set([
  'wikipedia.org', 'wikidata.org',
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com',
  'naver.com', 'daum.net', 'kakao.com', 'tistory.com', 'blog.naver.com',
  'amazon.com', 'amazon.co.kr',
  'made-in-china.com', 'globalsources.com', 'tradekey.com', 'tradeford.com', 'alibaba.com',
  'reuters.com', 'forbes.com', 'bloomberg.com', 'wsj.com', 'nytimes.com',
  'github.com', 'medium.com', 'pinterest.com', 'reddit.com', 'quora.com',
  'gsa.gov', 'sam.gov', 'fpds.gov',  /* gov reference portals — not buyers */
  'dnb.com', 'zoominfo.com', 'crunchbase.com'  /* directories — gated, not direct buyers */
]);

const HOST_BLACKLIST_SUFFIX = ['.go.kr'];

/**
 * Buyer-search query taxonomy (Phase 2A).
 *
 * Each sector defines queries across 4 axes — buyer-type · region ·
 * decision-role · vertical-context. Generic "Korean shredder distributor"
 * was replaced by procurement-vocabulary-specific queries that target
 * the actual humans who write the PO. Capped at ~10 per sector to stay
 * within the 1,000/month Tavily budget when running --all-sectors.
 *
 * Add new lines per sector freely — the verify pipeline dedupes by host.
 */
const QUERIES = {
  'k-security': [
    // Buyer-type
    'US paper shredder distributor wholesale catalog',
    'commercial shredder dealer United States vendor list',
    'high-security shredder reseller B2B',
    // Region / vertical
    'GSA Schedule 36 office equipment prime contractor',
    'federal government shredder procurement officer',
    'law firm document destruction service provider USA',
    // Decision-role
    'office equipment sourcing manager United States contact',
    'records management vendor RFP USA',
    // Adjacent
    'NAID AAA certified destruction company customer list',
    'bank document destruction vendor procurement'
  ],
  'k-tech': [
    'US display systems integrator stereoscopic 3D',
    'AV procurement specialist commercial integrator USA',
    'electronics components importer United States distributor',
    'medical imaging display reseller USA',
    'Korean semiconductor distributor United States contact',
    'OEM contract manufacturer sourcing manager US',
    'simulation training systems procurement defence',
    'broadcasting display systems integrator North America'
  ],
  'k-energy': [
    'industrial generator distributor United States procurement',
    'commercial backup power dealer US wholesaler',
    'battery storage system integrator USA buyer',
    'solar inverter procurement officer United States',
    'utility-scale energy storage wholesale buyer',
    'EV charger distributor importer US',
    'microgrid integration company procurement contact',
    'datacenter UPS power distributor'
  ],
  'k-bio': [
    'cosmeceutical importer United States procurement',
    'medical device distributor USA Korean OEM partner',
    'IVD diagnostics distributor wholesale US',
    'private-label skincare cosmeceutical brand sourcing',
    'biotech ingredient buyer USA cosmetic raw material',
    'dental device importer United States',
    'clinical lab equipment dealer US procurement',
    'pharmacy chain private-label sourcing manager'
  ],
  'k-beauty': [
    'K-beauty wholesale distributor United States private label',
    'Korean cosmetics importer USA Sephora',
    'skincare retail chain procurement manager USA',
    'beauty subscription box procurement vendor',
    'Costco Walmart beauty private-label sourcing',
    'Latam K-beauty distributor importer',
    'Middle East cosmetics distributor Korean brand',
    'Southeast Asia K-beauty wholesale buyer'
  ],
  'k-culture-goods': [
    'Korean traditional craft importer United States retail',
    'hanbok wholesale distributor USA fashion buyer',
    'premium ceramics importer gift retailer USA',
    'museum store buyer Korean traditional goods',
    'hanji stationery importer specialty retail',
    'K-pop merchandise licensing distributor US',
    'Korean modern hanbok fashion buyer Europe',
    'gift specialty store buyer Asia traditional craft'
  ],
  'k-franchise': [
    'Korean franchise master broker United States licensing',
    'food franchise development consultant US sourcing',
    'restaurant brand licensing buyer USA acquisition',
    'cafe franchise master licensee Middle East',
    'fitness franchise development director Asia',
    'beauty service franchise multi-unit operator US',
    'F&B franchise territory development manager',
    'master franchisee Korean concept Latin America'
  ],
  'k-smart-living': [
    'smart home appliance importer United States procurement',
    'Korean IoT device distributor USA wholesale',
    'air purifier wholesale buyer US private-label',
    'water purifier rental company procurement Asia',
    'home automation systems integrator USA',
    'kitchen appliance importer USA Costco',
    'wellness device distributor European Union',
    'small-appliance retail chain sourcing manager'
  ],
  'k-tourism-assets': [
    'Korea inbound tour operator United States travel agency',
    'hanok stay travel agency USA luxury booking',
    'Korea tourism wholesaler procurement DMC',
    'fractional ownership hospitality investor Korea hanok',
    'wellness travel agency Korean program buyer',
    'cultural tourism operator USA Korea program',
    'Asia luxury tour operator inbound Korea',
    'corporate retreat planner Korea booking agency'
  ]
};

function bareHost(url) {
  try {
    const h = new URL(url).host.toLowerCase();
    return h.replace(/^www\./, '').replace(/:\d+$/, '');
  } catch { return ''; }
}

function isBlacklisted(host) {
  if (!host) return true;
  if (HOST_BLACKLIST.has(host)) return true;
  for (const bad of HOST_BLACKLIST) {
    if (host === bad || host.endsWith('.' + bad)) return true;
  }
  for (const suffix of HOST_BLACKLIST_SUFFIX) {
    if (host.endsWith(suffix)) return true;
  }
  return false;
}

async function searchOnce(query, apiKey) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ERGSN-buyer-research/1.0 (+https://ergsn.net)'
    },
    body: JSON.stringify({ query, max_results: RESULTS_PER_QUERY, search_depth: 'basic', topic: 'general' })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.log(`tavily-call: status=${res.status}`);
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  // eslint-disable-next-line no-console
  console.log('tavily-call: status=200');
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map(r => ({ url: r.url, title: r.title || '', description: r.content || '' }));
}

async function loadForSector(sector, apiKey) {
  const queries = QUERIES[sector];
  if (!queries) {
    throw new Error(`No buyer-search queries defined for sector "${sector}". Edit seeds/search.js QUERIES.`);
  }
  const seenHost = new Set();
  const candidates = [];
  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    if (i > 0) await new Promise(r => setTimeout(r, PER_QUERY_DELAY_MS));
    let results;
    try { results = await searchOnce(q, apiKey); }
    catch (e) {
      // eslint-disable-next-line no-console
      console.error(`  search "${q}" → ${e.message}`);
      continue;
    }
    for (const r of results) {
      const host = bareHost(r.url);
      if (!host || isBlacklisted(host)) continue;
      if (seenHost.has(host)) continue;
      seenHost.add(host);
      candidates.push({ url: `https://${host}/`, sourceLabel: 'search:tavily', sourceQuery: q, sectorHint: sector });
    }
  }
  return candidates;
}

async function load(sector) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY required for buyer search seed');
  return loadForSector(sector, apiKey);
}

async function loadAll() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY required for buyer search seed');
  const sectors = Object.keys(QUERIES);
  const all = [];
  for (let i = 0; i < sectors.length; i += 1) {
    if (i > 0) await new Promise(r => setTimeout(r, PER_QUERY_DELAY_MS));
    const subset = await loadForSector(sectors[i], apiKey);
    all.push(...subset);
  }
  return all;
}

function availableSectors() { return Object.keys(QUERIES); }

module.exports = { load, loadAll, availableSectors };
