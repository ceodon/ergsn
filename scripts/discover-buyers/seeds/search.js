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

const QUERIES = {
  'k-security': [
    'US paper shredder distributor wholesale',
    'GSA Schedule 36 high-security shredder vendor',
    'federal government office equipment procurement contractor',
    'commercial shredder importer United States',
    'data destruction equipment dealer USA'
  ],
  'k-tech': [
    'US 3D stereoscopic display importer',
    'AV systems integrator stereoscopic distributor',
    'Korean tech components US distributor'
  ],
  'k-energy': [
    'industrial generator importer United States',
    'HYGEN hydrogen generator distributor',
    'commercial energy equipment dealer US'
  ],
  'k-bio': [
    'cosmeceutical importer United States',
    'Korean skincare ingredient buyer US distributor',
    'medical device importer USA Korean OEM'
  ],
  'k-beauty': [
    'K-beauty wholesale distributor United States',
    'Korean cosmetics importer US private label',
    'skincare retail chain procurement Korea'
  ],
  'k-culture-goods': [
    'Korean traditional craft importer US',
    'hanbok wholesale distributor United States',
    'Korean ceramics importer USA gift retailer'
  ],
  'k-franchise': [
    'Korean franchise master broker United States',
    'food franchise development consultant US',
    'restaurant brand licensing buyer USA'
  ],
  'k-smart-living': [
    'smart home appliance importer United States',
    'Korean IoT device distributor USA',
    'air purifier wholesale buyer US'
  ],
  'k-tourism-assets': [
    'inbound Korea tour operator US',
    'hanok stay travel agency USA',
    'Korea tourism wholesaler United States'
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
