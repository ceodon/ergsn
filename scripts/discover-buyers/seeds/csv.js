'use strict';

/**
 * CSV seed loader for buyer discovery.
 *
 * For when sales / partnerships has a hand-curated target list, you don't
 * want to round-trip through Tavily. Format (data/buyer-seeds.csv):
 *
 *   url,sector,buyerType,note
 *   https://www.shredderwarehouse.com/,k-security,distributor,strong-fit
 *   https://www.cosmoprofbeauty.com/,k-beauty,retail-chain,
 *   https://www.elektroniknet.de/,k-tech,system-integrator,EU
 *
 * Header row is required. `url` is the only required column. Empty cells
 * are fine — the verify pipeline + LLM will fill in the rest.
 *
 * Usage:
 *   node scripts/discover-buyers/discover.js --seed=csv
 *   node scripts/discover-buyers/discover.js --seed=csv --csv=data/special-list.csv
 *   node scripts/discover-buyers/discover.js --seed=csv --sector=k-security
 *     (filters CSV rows where the sector column matches)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'buyer-seeds.csv');

function parseCsv(text) {
  // Tiny CSV parser — handles quoted fields with commas, escaped quotes,
  // CRLF line endings. Skips blank rows and `#` comment rows.
  const rows = [];
  let cur = [], field = '', inQuote = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; i += 1; continue; }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuote = true; i += 1; continue; }
    if (ch === ',') { cur.push(field); field = ''; i += 1; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      cur.push(field); rows.push(cur);
      cur = []; field = ''; i += 1; continue;
    }
    field += ch; i += 1;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  // Drop blank rows + comment rows (first non-empty cell starts with `#`).
  // Earlier `some(c => !c.startsWith('#'))` was wrong — a comment line that
  // happens to contain commas would survive because later cells don't have
  // the `#` prefix.
  return rows.filter(r => {
    if (!r.length) return false;
    const first = (r[0] || '').trim();
    return first && !first.startsWith('#');
  });
}

function load({ csvPath, sector } = {}) {
  const file = csvPath ? path.resolve(csvPath) : DEFAULT_PATH;
  if (!fs.existsSync(file)) {
    throw new Error(`CSV not found: ${file}. Create it with a header row "url,sector,buyerType,note".`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length < 1) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idxUrl  = header.indexOf('url');
  const idxSec  = header.indexOf('sector');
  const idxType = header.indexOf('buyertype');
  const idxNote = header.indexOf('note');
  if (idxUrl === -1) throw new Error(`CSV must have a "url" column (header found: ${header.join(', ')})`);
  const out = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const url = (cells[idxUrl] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const rowSector = idxSec >= 0 ? (cells[idxSec] || '').trim() : '';
    if (sector && rowSector && rowSector !== sector) continue;
    const host = (() => { try { return new URL(url).host.toLowerCase().replace(/^www\./, ''); } catch { return ''; } })();
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push({
      url,
      sourceLabel: 'csv',
      sourceQuery: idxNote >= 0 ? (cells[idxNote] || '').trim() : '',
      sectorHint: rowSector || sector || 'multi',
      buyerTypeHint: idxType >= 0 ? (cells[idxType] || '').trim() : ''
    });
  }
  return out;
}

function loadAll({ csvPath } = {}) { return load({ csvPath }); }

function availableSectors() {
  // CSV is sector-agnostic — the user supplies sectors per row.
  return ['k-security','k-tech','k-energy','k-bio','k-beauty','k-culture-goods','k-franchise','k-smart-living','k-tourism-assets','multi'];
}

module.exports = { load, loadAll, availableSectors, DEFAULT_PATH };
