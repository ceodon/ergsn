# discover-buyers — Buyer Outreach Pipeline

Mirror of `discover-makers/` on the buyer side. Surfaces procurement /
importer / distributor / fed-procurement / retail-chain / system-integrator
candidates that are plausible matches for ERGSN-represented Korean
products, and produces a CAN-SPAM / GDPR-compliant cold-mail draft per
buyer for human approval before send.

## Pipeline

```
   Tavily search ─┐
   CSV seed      ─┼─►  verify.js  ──┐
   (wishlist)     │                  │
                  │     ┌── multi-page fetch (homepage + /contact /about /procurement
                  │     │   /vendor /partnerships /leadership; sitemap.xml fallback)
                  │     ├── email regex harvest (mailto: + body, priority-scored:
                  │     │   procurement@ > vendor@ > sales@ > info@)
                  │     ├── LLM extract (Llama-3.1-8B → Anthropic Haiku fallback)
                  │     ├── SAM.gov enrichment (US fed-procurement only, free API)
                  │     └── OpenCorporates cross-check (legal-registry confirm)
                  │
                  └─►  data/buyer-directory.json   (status: raw|verified)
                                       │
                                       ▼
                     compose.js (LLM)  ─►  data/buyer-outbox/<id>.json   (status: draft)
                                       │   ↑
                                       │   └── human review · approve in review-buyers UI
                                       ▼
                     send.js  /  review UI Send button
                                       │
                                       ▼
                  ergsn-mail Worker  /admin-send  →  Resend  →  buyer inbox
                                       │
                                       ▼
                      data/buyer-send-log.json   (append-only audit trail)
```

## Commands

```bash
# 1. Discover candidates — Tavily search (sector-tuned queries, all 9 sectors)
TAVILY_API_KEY=tvly-... npm run discover:buyers -- --sector=k-security
TAVILY_API_KEY=tvly-... npm run discover:buyers -- --all-sectors

# 1b. CSV seed — when sales has a hand-curated target list
#    edit data/buyer-seeds.csv (header: url,sector,buyerType,note)
npm run discover:buyers -- --seed=csv
npm run discover:buyers -- --seed=csv --csv=data/special-list.csv
npm run discover:buyers -- --seed=csv --sector=k-security  (filter CSV rows)

# 2. Generate per-buyer mail drafts (CF Workers AI primary, Anthropic Haiku fallback)
npm run compose:buyers -- --sector=k-security --max=5
npm run compose:buyers -- --buyer=shredder-warehouse-com --refresh

# 3. Approve drafts manually — open data/buyer-outbox/<id>.json,
#    edit if needed, flip "status": "draft"  →  "status": "approved"
#    (or use the review UI Approve button)

# 4. Dry-run send (prints plan, no actual mail goes out)
npm run send:buyers
npm run send:buyers -- --buyer=shredder-warehouse-com

# 5. Real send (requires --confirm + ERGSN_MAIL_ADMIN_KEY in .env)
ERGSN_MAIL_ADMIN_KEY=<the-admin-key> npm run send:buyers -- --confirm

# 6. Review UI (port 5175 — both maker:5174 and buyer:5175 can run together)
npm run review:buyers
# Token mode (LAN/tunnel access):
REVIEW_TOKEN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))") npm run review:buyers
```

## Required env vars (in `.env`)

| Variable | Purpose |
|---|---|
| `TAVILY_API_KEY` | Buyer search seed (1,000 credits/month free, shared with maker side) |
| `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_TOKEN` | LLM extraction + mail composition (Llama-3.1-8B, 10,000 Neurons/day free) |
| `ANTHROPIC_API_KEY` | Haiku 4.5 fallback when CF quota exhausted |
| `ERGSN_MAIL_ADMIN_KEY` | Worker secret matching `ergsn-mail` Worker's `ADMIN_KEY` — required for real send |
| `ERGSN_MAIL_ENDPOINT` | Defaults to `https://ergsn-mail.ceodon.workers.dev` |
| `BUYER_REVIEW_PORT` | Defaults to 5175 |
| `REVIEW_TOKEN` | Optional — opens LAN/tunnel access (same model as maker review) |
| `SAM_GOV_API_KEY` | Optional — lifts SAM.gov 10/min rate limit. Free at [sam.gov](https://sam.gov/data-services). Falls back to `DEMO_KEY`. |
| `OPENCORPORATES_API_TOKEN` | Optional — lifts OpenCorporates 50/day limit. Free at [opencorporates.com](https://opencorporates.com/). |
| `APOLLO_API_KEY` | (Phase 3C, not yet wired) — would enable email-finder fallback at 100 enrichments/month free. Add when needed. |

## Files written

| Path | Purpose |
|---|---|
| `data/buyer-directory.json` | Master list of buyer entries (mirrors maker-directory) |
| `data/buyer-directory.schema.json` | JSON Schema for the directory |
| `data/buyer-outbox/<id>.json` | One mail draft per buyer (read/written by compose / send / UI) |
| `data/buyer-send-log.json` | Append-only audit log of every send attempt (success or fail) |

## Compliance baked in

* **CAN-SPAM**: every draft auto-appends a physical address footer + a
  one-click unsubscribe link (`https://ergsn.net/unsubscribe?id=<buyerId>&sig=<...>`).
* **GDPR**: same footer, plus the cold-email disclaimer. Status
  `unsubscribed` blocks future composition + send for that buyer.
* **Truthful subjects**: the LLM prompt forbids ALL-CAPS, fake urgency,
  and clickbait. Subjects always lead with the actual offer.
* **Plain-text alt body**: every draft includes `textBody` so receivers
  with HTML disabled still get a readable message.
* **Defense-in-depth**:
  * Buyer must be `verified` or `queued` before compose.
  * Draft must be `approved` before send.
  * Same buyer can't be sent again within `DUP_WINDOW_DAYS=7` without `--force`.
  * Send writes to `buyer-send-log.json` regardless of outcome — fully
    auditable trail.

## Adding a new sector

1. Open `seeds/search.js` and add a `<sector>: [...]` entry to `QUERIES`.
2. Open `lib/compose-mail.js` and add a `<sector>: { flagship, proof, angle }`
   entry to `SECTOR_PITCH`. The LLM will paraphrase these into the body.
3. Run `npm run discover:buyers -- --sector=<sector>`.

## Things this v0 does NOT include yet

* **Resend webhook for replies**. Open from buyer is currently invisible to
  the system — you have to read the inbox manually. v1 will add a webhook
  endpoint on `ergsn-mail` that flips buyer.status to `replied` and pushes
  a Telegram alert.
* **Unsubscribe handler**. The footer link points to
  `https://ergsn.net/unsubscribe` but that page does not exist yet. v1 adds
  a tiny Worker that records the click and flips `status: unsubscribed`.
* **Apollo.io email-finder fallback** (Phase 3C). When SAM.gov / OpenCorporates
  / on-page harvest all fail to surface a procurement email, Apollo's
  free 100/month tier could fill the gap. Path: add `lib/enrich-apollo.js`
  + `APOLLO_API_KEY` env, call from verify.js after the harvest step.
* **A/B subject testing**. Single subject per buyer.
* **HTML preview testing across mail clients**. Use the Resend dashboard
  preview before approving.
