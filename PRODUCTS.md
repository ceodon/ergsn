# Product ingestion pipeline

End-to-end workflow for adding products to ERGSN at scale — from a maker's
PDF or photo drop to a live catalog entry. Built additively over the
existing inline catalog: **nothing you've already shipped gets touched**;
new products flow through `data/products.json`.

## Quick reference

| Action | Command |
|---|---|
| Install deps (first time only) | `npm install` |
| Add / edit products | edit `data/products.json` then `npm run build:products` |
| Bulk-convert maker photos | drop into `images/raw/`, `npm run process:images` |
| Extract product row from a PDF | `ANTHROPIC_API_KEY=sk-ant-... npm run extract:pdf -- path/to/spec.pdf` |

## 1 — Data source: `data/products.json`

Single source of truth for new catalog entries. Schema lives in
`data/products.schema.json` (standard JSON Schema). Top-level shape:

```jsonc
{
  "products": [
    {
      "id": "dl-16xd-v2",
      "sector": "k-security",
      "active": true,
      "model": "DL-16XD v2",
      "part": "DL16XD-V2 (RS-8250A)",
      "sub": "Level 3 / P-4 Cross Cut — next-gen flagship",
      "desc": "Paragraph shown in the product modal...",
      "img": "images/products/dl-16xd-v2.jpg",
      "specs": [["Motor", "3.5 Hp"], ["Speed", "35 FPM"]],
      "features": ["All-metal chain drive", "Oil-free"],
      "tags": ["government", "healthcare"],
      "scale": ["l", "xl"],
      "moq": 5, "leadMin": 6, "leadMax": 8,
      "priceLow": 9500, "priceHigh": 11000,
      "maker": "ERGSN CO., LTD.",
      "cardTag": "Flagship Industrial",
      "matchDesc": "3.5 Hp · 35 FPM · NEMA L5-30P"
    }
  ]
}
```

- `active: false` hides the row — useful for drafts.
- Products with an inactive sector (K-Beauty, K-Franchise, etc.) will not
  render a card yet because those sectors don't have a grid; the data
  still lives in `window.P` and MATCH_CATALOG for chatbot / match use.
- `id` must be unique across new rows and against legacy inline ids.

## 2 — Build

```bash
npm run build:products
```

Reads `data/products.json`, runs field validation (required fields,
`id` slug shape, specs tuple shape), and writes
**`scripts/products-catalog.js`** — an auto-generated IIFE that:

1. Merges each row into `window.P` without overwriting any existing id.
2. Appends rows to `window.MATCH_CATALOG` (used by AI Partner Match).
3. On `DOMContentLoaded`, renders a card for each product into the grid
   matching its sector (same HTML structure index.html uses inline).

`index.html` loads `scripts/products-catalog.js` via a `<script defer>`
tag at the bottom, so simply commit + push and new products appear.

**Never edit `scripts/products-catalog.js` by hand.** It gets regenerated.

## 3 — Image pipeline: `images/raw/` → `images/products/`

Bulk convert maker photos to the size / format the catalog expects:

```bash
mkdir -p images/raw
# drop any .jpg / .jpeg / .png into images/raw/
npm run process:images
```

Behavior:

- Resizes to **800 px** on the long edge (2× DPR headroom for retina).
- Writes **both `.jpg` and `.webp`** to `images/products/` with a
  slugified filename (`DL 16XD Photo.jpg` → `dl-16xd-photo.{jpg,webp}`).
- Moves the raw original into `images/raw/processed/` so reruns are
  idempotent.

In `data/products.json` the `img` field should point at the generated JPG
(`images/products/dl-16xd-photo.jpg`); the runtime `<picture>` block
auto-discovers the WebP sibling.

## 4 — PDF → product row (Claude API)

Maker sends a spec PDF? Skip the typing.

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
npm run extract:pdf -- path/to/maker-spec.pdf --sector k-energy
```

Runs the PDF through `claude-sonnet-4-6` with `data/products.schema.json`
as the structural constraint and prints a JSON object you can paste into
`data/products.json`'s `products` array.

- Schema + instruction prefix is cached via `cache_control: ephemeral`, so
  batch-processing 50+ PDFs reuses the cached portion at 10% input cost.
- Output goes to **stdout only** — redirect with `>` or pipe into `jq` /
  your favourite JSON merge tool.
- Always review the generated row before committing. Claude is good, not
  perfect; watch for placeholders marked `(TBD)`.

## 5 — Maker onboarding funnel

Korean manufacturers submit their own product data via the expanded
form at `partners-kr.html`:

- Required fields cover the core partner application.
- Optional "Verified Partner — 제품 등록" block asks for model, part,
  sub-title, specs, features, description, MOQ, lead time, and a cloud
  share link for 3 product photos.
- Submissions relay through FormSubmit.co to `ceodon@gmail.com` with a
  flagged Telegram notification so the trade desk can verify and
  ingest — manually copy fields into `data/products.json`, drop photos
  into `images/raw/`, and run both `process:images` + `build:products`.

The Verified Partner tier (`memory/project_maker_pricing_tiers.md`:
₩290k/yr) lists "제품 정보 + 이미지 3장 제공" as the upgrade trigger —
the form fulfils that requirement in one submission.

## 6 — Full loop for 100 products (realistic timeline)

Assuming 100 product PDFs from verified makers:

1. **Hour 1-3** — `npm run extract:pdf` across every PDF (1-2 min / doc
   with prompt caching), saving the JSON rows into a scratch file.
2. **Hour 3-4** — Review + merge rows into `data/products.json`. Fix
   any `(TBD)` placeholders by hand.
3. **Hour 4-6** — Drop 300 photos into `images/raw/` (3 per product),
   `npm run process:images`, rename photo files to match product ids.
4. **Hour 6-7** — `npm run build:products`, spot-check the rendered
   cards, commit + push.

Total: **~1 day**, vs. ~50 hours of manual HTML editing.

## Failure modes to watch for

- **`id` collision with legacy inline products** — the runtime merge
  preserves the existing entry; new data silently ignored. Pick a
  unique id (`rosettaplus-2` not `rosettaplus`).
- **Inactive sector** — cards for `k-beauty` / `k-franchise` etc. won't
  render until that sector's grid goes live in `index.html`. The data
  still loads into `P` and chat.
- **Missing image** — `img` pointing at a non-existent file shows a
  broken `<img>`. Run `process:images` first or clear the field.
- **Claude extraction errors** — if the PDF is a scan with no OCR, the
  model may return shallow data. Fall back to manual entry.
