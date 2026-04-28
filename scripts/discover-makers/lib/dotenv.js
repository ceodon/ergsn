'use strict';

/**
 * Tiny .env loader for the discover-makers entry script.
 *
 * Why not the `dotenv` npm package?  This repo intentionally keeps its
 * dependency footprint tiny (esbuild, sharp, anthropic-sdk only). A 30-line
 * loader covers our needs without adding a transitive dep tree.
 *
 * Behaviour:
 *  - Reads .env at the repo root
 *  - Sets process.env[KEY] = VALUE for any line of form KEY=VALUE
 *  - Does NOT overwrite a variable that's already in the environment
 *  - Strips surrounding single or double quotes
 *  - Ignores blank lines and lines starting with '#'
 */

const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envFile = path.resolve(__dirname, '..', '..', '..', '.env');
  if (!fs.existsSync(envFile)) return { loaded: 0, file: envFile };
  const text = fs.readFileSync(envFile, 'utf8');
  let n = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
      n += 1;
    }
  }
  return { loaded: n, file: envFile };
}

module.exports = { loadDotEnv };
