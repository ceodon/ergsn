'use strict';

/**
 * Tavily Search API seed.
 *
 * Free tier: https://tavily.com/pricing  →  "Researcher" plan
 *   - 1,000 API credits / month
 *   - NO credit card required at signup
 *   - Email-only signup
 *
 * Setup: register at https://app.tavily.com/, copy the API key into
 *   .env  →  TAVILY_API_KEY=tvly-...
 *
 * Usage from discover.js:
 *   node scripts/discover-makers/discover.js --seed=search --sector=k-beauty
 *   node scripts/discover-makers/discover.js --seed=search --all-sectors
 *
 * Why Tavily and not Brave / Google CSE?
 *   - Brave: $5/1000 req with $5/mo "free credit", but credit card REQUIRED
 *   - Google Custom Search JSON API: 100/day free, but "closed to new
 *     customers" (Google deprecating in favour of Vertex AI Search by 2027)
 *   - SerpAPI: 250/mo free
 *   - Tavily: 1,000/mo free, no card → best fit for ERGSN's no-cost discovery
 *
 * Strategy:
 *   - Per sector, run 2-3 hand-tuned queries that bias toward Korean
 *     manufacturer sites with English content
 *   - Take up to 10 web results per query (Tavily caps at 20)
 *   - Filter out aggregators/social/news (they're not the maker site)
 *   - Dedup by host
 *   - Hand the surviving URLs to verify.js which fetches + lang-detects them
 *
 * Cost shape:
 *   - 1 search = 1 credit (basic depth)
 *   - 9 sectors × 2-3 queries = 18-27 credits per full sweep
 *   - Free tier comfortably supports a daily sweep
 */

const ENDPOINT = 'https://api.tavily.com/search';
const RESULTS_PER_QUERY = 10;
const PER_QUERY_DELAY_MS = 600;

// Sites that are never a manufacturer's own homepage — dropped at the
// search-result level so verify doesn't waste fetches on them.
const HOST_BLACKLIST = new Set([
  'wikipedia.org', 'wikidata.org',
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com',
  'alibaba.com', 'aliexpress.com', 'amazon.com', 'amazon.co.kr',
  'made-in-china.com', 'globalsources.com', 'tradekey.com', 'tradeford.com',
  'g2.com', 'crunchbase.com', 'pitchbook.com', 'bloomberg.com',
  'koreaherald.com', 'koreatimes.co.kr', 'pulsenews.co.kr', 'reuters.com', 'forbes.com',
  'kotra.or.kr', 'tradekorea.com', 'gobizkorea.com', 'ec21.com', 'buykorea.org',
  'made-in-korea.com', 'kompass.com',
  'naver.com', 'daum.net', 'kakao.com', 'tistory.com', 'blog.naver.com',
  'github.com', 'medium.com', 'pinterest.com', 'reddit.com', 'quora.com'
]);

const HOST_BLACKLIST_SUFFIX = ['.go.kr', '.gov']; // government / aggregator domains

const QUERIES = {
  'k-beauty': [
    'Korean cosmetics OEM manufacturer English homepage',
    'Korean skincare brand ODM export site:.kr OR site:.com'
  ],
  'k-bio': [
    'Korean medical device manufacturer English homepage',
    'Korean biotech pharmaceutical company export site:.kr OR site:.com'
  ],
  'k-security': [
    'Korean CCTV manufacturer English homepage',
    'Korean access control biometric manufacturer English'
  ],
  'k-energy': [
    'Korean battery manufacturer English homepage',
    'Korean solar inverter ESS manufacturer English export'
  ],
  'k-smart-living': [
    'Korean home appliance manufacturer English homepage',
    'Korean kitchen appliance air purifier manufacturer English'
  ],
  'k-tech': [
    'Korean semiconductor manufacturer English homepage',
    'Korean electronics components manufacturer English export'
  ],
  'k-culture-goods': [
    'Korean hanbok manufacturer English homepage',
    'Korean ceramics pottery brand English export',
    'Korean hanji paper traditional craft manufacturer English'
  ],
  'k-franchise': [
    'Korean franchise food brand English homepage',
    'Korean restaurant cafe franchise English export'
  ],
  'k-tourism-assets': [
    'Korean hotel resort English homepage',
    'Korean traditional hanok stay English booking'
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
      'User-Agent': 'ERGSN-research/1.0 (+https://ergsn.net)'
    },
    body: JSON.stringify({
      query,
      max_results: RESULTS_PER_QUERY,
      search_depth: 'basic',
      topic: 'general'
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map(r => ({ url: r.url, title: r.title || '', description: r.content || '' }));
}

async function loadForSector(sector, apiKey) {
  const queries = QUERIES[sector];
  if (!queries) {
    throw new Error(`No search queries defined for sector "${sector}". Edit seeds/search.js QUERIES.`);
  }
  const seenHost = new Set();
  const candidates = [];
  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    if (i > 0) await new Promise(r => setTimeout(r, PER_QUERY_DELAY_MS));
    let results;
    try {
      results = await searchOnce(q, apiKey);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`  search "${q}" → ${e.message}`);
      continue;
    }
    for (const r of results) {
      const host = bareHost(r.url);
      if (!host || isBlacklisted(host)) continue;
      if (seenHost.has(host)) continue;
      seenHost.add(host);
      candidates.push({
        url: `https://${host}/`,
        sourceLabel: 'search:tavily',
        sourceQuery: q,
        sectorHint: sector
      });
    }
  }
  return candidates;
}

async function load(sector) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is required for the search seed. Get a free key (1,000/mo, NO credit card) at https://app.tavily.com/ and add TAVILY_API_KEY=tvly-... to .env');
  }
  return loadForSector(sector, apiKey);
}

async function loadAll() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is required for the search seed. Get a free key (1,000/mo, NO credit card) at https://app.tavily.com/ and add TAVILY_API_KEY=tvly-... to .env');
  }
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
