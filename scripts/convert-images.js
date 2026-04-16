#!/usr/bin/env node
/**
 * Generate WebP versions of every JPG under images/ (product images included).
 * Additionally re-encode large heroes to a tighter quality target.
 *
 * Install once: npm install --no-save --prefix /tmp/webp-tool sharp
 * Run:          node scripts/convert-images.js
 *
 * Re-running is safe — it overwrites only the .webp outputs it produces.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(os.tmpdir(), 'webp-tool', 'node_modules', 'sharp'));

const ROOT = path.resolve(__dirname, '..');
const targets = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.jpe?g$/i.test(name)) targets.push(full);
  }
}
walk(path.join(ROOT, 'images'));

(async () => {
  let totalSrc = 0, totalOut = 0, count = 0;
  for (const src of targets) {
    const out = src.replace(/\.jpe?g$/i, '.webp');
    const srcSize = fs.statSync(src).size;
    // Heroes (>=400KB source) get stricter quality to target <200KB.
    const isHero = srcSize > 400 * 1024;
    const quality = isHero ? 72 : 82;
    await sharp(src).webp({ quality, effort: 5 }).toFile(out);
    const outSize = fs.statSync(out).size;
    totalSrc += srcSize; totalOut += outSize; count++;
    const rel = path.relative(ROOT, src).replace(/\\/g, '/');
    const pct = Math.round((1 - outSize / srcSize) * 100);
    console.log(`${rel.padEnd(48)} ${(srcSize/1024).toFixed(0).padStart(5)}K -> ${(outSize/1024).toFixed(0).padStart(5)}K  (-${pct}%)`);
  }
  console.log(`\n${count} files converted. Total: ${(totalSrc/1024).toFixed(0)}K -> ${(totalOut/1024).toFixed(0)}K  (-${Math.round((1 - totalOut/totalSrc) * 100)}%)`);
})().catch(e => { console.error(e); process.exit(1); });
