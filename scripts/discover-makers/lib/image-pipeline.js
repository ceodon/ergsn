'use strict';

/**
 * Image pipeline for register-with-detail.
 *
 * Mirrors the existing scripts/process-images.js logic but operates on
 * remote URLs instead of local files in images/raw/. Pulls 1-3 hero
 * candidates, normalises to 800px max edge, writes both .jpg and .webp
 * to images/products/<slug>.{jpg,webp} so the live catalog has matching
 * card + modal assets.
 *
 * Returns { ok, primaryRel, all } where primaryRel is the relative
 * path you put into the product row's "img" field
 * (e.g. "images/products/biostar-2.jpg").
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

let sharp;
try { sharp = require('sharp'); } catch (_) { sharp = null; }

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'images', 'products');

const MAX_EDGE = 800;
const JPG_QUALITY = 82;
const WEBP_QUALITY = 78;
const MAX_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 12000;

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'ERGSN-research/1.0 (+https://ergsn.net)', 'Accept': 'image/*,*/*;q=0.8' } }, (res) => {
      // Follow one redirect (Location header) — image CDNs like to redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = new URL(res.headers.location, url).href;
        return fetchBuffer(loc).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > MAX_BYTES) { req.destroy(new Error('image too large (>6MB)')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('image fetch timeout')));
  });
}

/**
 * Download image URLs and write resized .jpg + .webp pair under the
 * given base slug. Returns the first successful pair as primary.
 *
 * Multiple candidates: index suffix added (-2, -3 …) so the user can
 * swap if the auto-picked primary is off.
 */
async function downloadAndProcess(slugBase, urls) {
  if (!sharp) throw new Error('sharp not installed; run `npm install` from repo root');
  if (!Array.isArray(urls) || urls.length === 0) return { ok: false, primaryRel: '', all: [], error: 'no image URLs' };
  ensureDir(OUT_DIR);

  const all = [];
  let primaryRel = '';
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const slug = i === 0 ? slugBase : `${slugBase}-${i + 1}`;
    try {
      const buf = await fetchBuffer(url);
      const pipeline = sharp(buf).resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
      const jpgPath = path.join(OUT_DIR, `${slug}.jpg`);
      const webpPath = path.join(OUT_DIR, `${slug}.webp`);
      await pipeline.clone().jpeg({ quality: JPG_QUALITY, mozjpeg: true }).toFile(jpgPath);
      await pipeline.clone().webp({ quality: WEBP_QUALITY }).toFile(webpPath);
      const rel = `images/products/${slug}.jpg`;
      all.push({ url, slug, rel, ok: true });
      if (!primaryRel) primaryRel = rel;
    } catch (e) {
      all.push({ url, slug, ok: false, error: e.message });
    }
  }
  return { ok: !!primaryRel, primaryRel, all };
}

module.exports = { downloadAndProcess };
