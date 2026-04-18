#!/usr/bin/env node
/**
 * process-images.js — bulk resize + WebP conversion for ERGSN product photos
 *
 * Drop raw maker photos into `images/raw/` (any mix of .jpg / .jpeg / .png).
 * Run `npm run process:images` and the script:
 *
 *   1. Reads every file in images/raw/
 *   2. Resizes to max 800 px on the long edge (sharp "inside" fit, no crop)
 *   3. Writes a JPG and a WebP of each to images/products/
 *   4. Slugifies filenames to lowercase hyphenated, e.g. "DL 16XD Photo.jpg"
 *      → "dl-16xd-photo.jpg" + "dl-16xd-photo.webp"
 *   5. Moves originals to images/raw/processed/ so rerunning is idempotent
 *
 * Why 800 px: product cards render at ~280 px intrinsic, modal at ~900 px
 * max; 800 px gives 2× DPR headroom for retina without inflating page
 * weight. WebP fallback keeps total under ~60 KB per photo.
 *
 * Requires the `sharp` peer dependency — `npm install` before first run.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (_) {
  console.error('✗ sharp not installed. Run `npm install` from the repo root first.');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const RAW  = path.join(ROOT, 'images', 'raw');
const OUT  = path.join(ROOT, 'images', 'products');
const DONE = path.join(RAW, 'processed');

const MAX_EDGE = 800;     // longest edge in pixels
const JPG_QUALITY = 82;   // slight compression; visually lossless at product card sizes
const WEBP_QUALITY = 78;

function slugify(name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return { slug, ext: ext.toLowerCase() };
}

async function ensureDirs() {
  for (const d of [OUT, DONE]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

async function processFile(file) {
  const src = path.join(RAW, file);
  const { slug, ext } = slugify(file);
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    console.log(`  ↷ skipping ${file} (unsupported ext ${ext})`);
    return false;
  }

  const jpgOut  = path.join(OUT, `${slug}.jpg`);
  const webpOut = path.join(OUT, `${slug}.webp`);

  const pipeline = sharp(src).resize({
    width:  MAX_EDGE,
    height: MAX_EDGE,
    fit:    'inside',
    withoutEnlargement: true
  });

  await pipeline.clone().jpeg({ quality: JPG_QUALITY, mozjpeg: true }).toFile(jpgOut);
  await pipeline.clone().webp({ quality: WEBP_QUALITY }).toFile(webpOut);

  /* Move raw file into processed/ so reruns don't re-process it. */
  fs.renameSync(src, path.join(DONE, file));

  const stat = fs.statSync(webpOut);
  console.log(`  ✓ ${file}  →  ${slug}.{jpg,webp}  (webp: ${Math.round(stat.size / 1024)} KB)`);
  return true;
}

async function main() {
  if (!fs.existsSync(RAW)) {
    console.log(`images/raw/ doesn't exist — create it and drop raw photos in, then rerun.`);
    console.log(`  mkdir -p images/raw`);
    process.exit(0);
  }
  await ensureDirs();
  const files = fs.readdirSync(RAW)
    .filter(f => fs.statSync(path.join(RAW, f)).isFile());
  if (!files.length) {
    console.log('images/raw/ is empty — nothing to do.');
    return;
  }
  console.log(`Processing ${files.length} file(s)…`);
  let count = 0;
  for (const f of files) {
    try {
      const ok = await processFile(f);
      if (ok) count++;
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }
  console.log(`Done — ${count} image(s) written to images/products/.`);
}

main().catch(e => { console.error(e); process.exit(1); });
