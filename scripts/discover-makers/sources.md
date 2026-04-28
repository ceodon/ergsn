# Seed inventory — Korean manufacturer directories

Surveyed 2026-04-27 for the discover-makers pipeline. Decisions inform which seed plugins are worth implementing.

## Open / friendly

### GobizKOREA — `https://www.gobizkorea.com/`
- robots.txt: `User-agent:* Allow:/` ✓ fully open
- Operator: KOSME (중소기업유통센터, Jinju)
- Locale: English-default site, JSON-LD `LocalBusiness` on root
- Sitemap: present but stale (lastmod 2019-2020) — limited use
- Category navigation: requires HTML scraping of homepage / inner nav (HEAD blocked, GET works)
- Verdict: good, but needs nav crawl since sitemap won't list current suppliers

### tradeKorea — `https://www.tradekorea.com/`
- robots.txt: `Allow:/` with only `/mytradekorea/` and a single product detail Disallow ✓
- Operator: KITA (한국무역협회)
- Locale: English + Korean
- Sitemap: present
- Page rendering: heavy JS — supplier listings may need headless browser
- Verdict: good signal quality, fetcher cost higher

### EC21 — `https://www.ec21.com/`
- robots.txt: `Allow:/` with `Crawl-delay: 1`; many login/search internals Disallow'd
- Locale: English-first global B2B
- Has `/premium-suppliers/` and `/global-supplier-directory/` pages discoverable from homepage
- Verdict: workable; honour 1s delay

## Restricted / closed

### Made-in-Korea — `https://www.made-in-korea.com/`
- robots.txt: `User-agent: * Disallow: /` (whitelist Googlebot/Slurp/MSNBot only)
- Verdict: **DO NOT crawl**

### buyKOREA — `https://www.buykorea.org/`
- robots.txt: 301 redirect, no actual robots file
- Operator: KOTRA
- Verdict: needs site-direct survey to confirm allowance + structure

## Search-engine alternative

### Tavily Search API — `https://api.tavily.com/search`  (chosen)
- Free tier: 1,000 credits / month
- **NO credit card required** at signup (email only)
- Bearer-token JSON POST, returns ranked results array
- Verdict: best zero-cost option; the `search` seed implementation lives in `seeds/search.js`

### Brave Search API — `https://api.search.brave.com/`  (rejected)
- $5/1000 requests; auto-applies $5/mo free credit (~1,000 free req/mo) — but credit card required
- Verdict: not "free" by ERGSN policy; rejected in favour of Tavily

### Google Custom Search JSON API — `https://developers.google.com/custom-search/v1/`  (rejected)
- 100 queries/day free for existing customers
- "Closed to new customers" — Google deprecating in favour of Vertex AI Search by 2027
- Verdict: not viable for new signup

### SerpAPI — `https://serpapi.com/`  (alternative)
- Free tier: 250 searches / month
- Verdict: smaller free pool than Tavily; not chosen

## Wikidata SPARQL — `https://query.wikidata.org/`
- Open, no key required
- Query: companies headquartered in South Korea by industry/instance
- Results limited to large/notable companies — small/mid manufacturers absent
- Verdict: useful for golden set, not for breadth

## Recommendation

1. **Phase B (done)**: `manual` seed — hand-curated, ~5-10 makers per sector to validate the pipeline. 67 candidates → 22 English homepages auto-detected → 52 entries baseline.
2. **Phase C (done)**: LLM enrichment — `lib/llm-extract.js` uses Cloudflare Workers AI (free 10k Neurons/day, account already exists); needs `CLOUDFLARE_AI_TOKEN` in `.env`. (Earlier Gemini attempt rejected: free RPD too low for batch enrichment of 173 entries.)
3. **Phase A (done)**: `search` seed — Tavily Search API (free 1k/mo, no card); needs `TAVILY_API_KEY` in `.env`.
4. **Phase D (planned)**: GobizKOREA + EC21 directory crawlers (deeper, higher signal).
5. **Phase E (only if needed)**: Wikidata SPARQL for the corporate/listed segment.
