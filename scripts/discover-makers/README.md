# scripts/discover-makers/

Find Korean manufacturers that publish an English-language homepage, group them by ERGSN sector, and accumulate the result in `data/maker-directory.json` (the prospect pool — separate from `data/maker-contacts.json`, which is the verified-onboarded registry).

## Pipeline

```
seed (URL list)  →  fetch  →  detect English homepage  →  extract structured hints  →  dedup + persist
                                                                ↑
                                                  optional LLM enrichment (Claude Haiku 4.5)
```

The pipeline is split so each seed plugin only has to emit a list of candidate URLs (`{ url, sourceLabel, sectorHint? }`) and the rest is shared.

## Layout

| Path | Role |
| --- | --- |
| `lib/fetch.js` | Polite fetch (UA, throttle, retry, encoding) |
| `lib/lang-detect.js` | Decide whether a fetched HTML is/has English |
| `lib/normalize.js` | URL → host → slug; dedup keys |
| `lib/extract-hints.js` | Pull JSON-LD, OpenGraph, meta description, html-lang from HTML |
| `lib/dotenv.js` | Tiny .env loader — picks up `BRAVE_API_KEY` / `ANTHROPIC_API_KEY` |
| `lib/llm-extract.js` | Cloudflare Workers AI enrichment (llama-3.1-8b-instruct) — fills `legalName`, `headquartersAddress`, `businessType`, `exportSignals`, `subCategory` |
| `review-server.js` | Local 127.0.0.1 HTTP server backing the review UI |
| `review.html` | Card-grid review UI — filter by sector / status / businessType / English; one click to verify · pending · reject |
| `lib/persistence.js` | Read / merge / write `data/maker-directory.json` |
| `seeds/manual.js` | Hand-picked seed list (golden set) |
| `seeds/search.js` | Brave Search API seed (auto discovery) |
| `seeds/ec21.js` | (planned) EC21 supplier directory crawler |
| `verify.js` | Core: take a seed's candidate list → fetch → detect → extract → persist |
| `discover.js` | Entry point: choose seed + sector + run verify |

## Seed status

| Seed | Status | Notes |
| --- | --- | --- |
| `manual` | working | Hand-curated lists per sector; baseline + golden set |
| `search` | working — needs `TAVILY_API_KEY` in `.env` | Tavily Search API (free 1,000/mo, NO credit card) → broadest coverage, host-blacklist filters out aggregators/social/news |
| `ec21` | planned | EC21 robots-friendly (1s crawl-delay), supplier directory pages |
| `tradekorea` | planned | KITA, robots-friendly, JS-rendered → may need Playwright |
| `gobizkorea` | planned | KOSME, robots fully open, but sitemap stale → category navigation needed |
| `buykorea` | planned | KOTRA, robots.txt missing, structure unknown |

## Detection heuristics (lib/lang-detect.js)

A page counts as having an English homepage when ANY of:
- `<html lang="en…">` on the fetched URL
- `<link rel="alternate" hreflang="en…" href="...">` pointing to an English variant
- A discoverable `/en/`, `/eng/`, `/english/` subpath that returns 200 with `<html lang="en…">`
- An `en.<host>` subdomain that returns 200 with `<html lang="en…">`
- A language toggle anchor whose text matches `EN | English | ENGLISH` and whose href is on the same host
- Content heuristic: ≥70% ASCII letters in the visible text after stripping Hangul ranges (fallback)

The first-matching strategy wins; the result is stored in `englishDetectedBy` so we can audit later.

## CLI

```sh
# Seed mode — fetch + verify + persist new entries
npm run discover:makers -- --seed=manual --sector=k-beauty
npm run discover:makers -- --seed=manual --all-sectors
npm run discover:makers -- --seed=search --sector=k-culture-goods    # needs TAVILY_API_KEY
npm run discover:makers -- --seed=search --all-sectors

# Enrich mode — re-fetch entries with empty fields, ask Cloudflare Workers AI for structured fields
npm run discover:makers -- --enrich --sector=k-beauty
npm run discover:makers -- --enrich --all-sectors --max=200          # needs CLOUDFLARE_AI_TOKEN

# Either mode supports --dry-run

# Review UI — local browser-based card grid; verify / pending / reject; persists to JSON
npm run review:makers
# then open http://127.0.0.1:5174 in your browser
```

## .env keys (required for Phases A and C)

```
TAVILY_API_KEY=tvly-...             # Tavily Search API for the 'search' seed; free 1,000/mo, NO credit card (https://app.tavily.com/)
CLOUDFLARE_ACCOUNT_ID=...           # already present from existing ERGSN tooling
CLOUDFLARE_AI_TOKEN=...             # Cloudflare Workers AI for --enrich; free 10,000 Neurons/day. Dashboard → My Profile → API Tokens → "Workers AI" template
```

Both keys are free-tier without a credit card requirement — chosen on purpose so the discovery pipeline runs at zero cost.

`.env` is loaded automatically by `lib/dotenv.js` at the start of `discover.js`. Existing values in the shell environment win over `.env` so dev shells can override.

## What it does NOT do

- No fetch of pages disallowed by `robots.txt`
- No login/walled content
- No bypass of rate limits — any per-host throttle is honoured
- No automatic outreach — entries land at `status: "raw"`; outreach is a separate manual step
