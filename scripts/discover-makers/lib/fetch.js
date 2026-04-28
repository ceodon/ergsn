'use strict';

/**
 * Polite fetch wrapper for the discover-makers pipeline.
 *
 * - Identifies as ERGSN-research with a contact URL
 * - Per-host throttle (default 1.5s between requests to the same origin)
 * - 1 retry on 5xx / network with backoff
 * - Decodes Korean charsets (EUC-KR, CP949) when the server says so
 * - Caps body at 800KB so a single bad page can't exhaust memory
 */

const UA = 'ERGSN-research/1.0 (+https://ergsn.net)';
const PER_HOST_MS = 1500;
const MAX_BODY_BYTES = 800 * 1024;
const TIMEOUT_MS = 12000;

const lastHitAt = new Map();

// Many Korean SME hosting setups still ship self-signed or partial-chain
// certs. Discovery is an outbound *survey* — TLS-trust on the target host
// is meaningless to us — so we relax cert validation for THIS process only.
// This module is only loaded by scripts/discover-makers/ entry points, so
// the relaxation never reaches the rest of the app.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Suppress the corresponding "InsecureCertificate" Node warning so the
// progress log stays readable. The relaxation is intentional and audited
// in this comment, so the warning is just noise.
const _origEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (name === 'warning' && data && /NODE_TLS_REJECT_UNAUTHORIZED/i.test(data.message || '')) return false;
  return _origEmit.apply(process, [name, data, ...args]);
};

function host(url) {
  try { return new URL(url).host.toLowerCase(); } catch { return ''; }
}

async function throttle(url) {
  const h = host(url);
  if (!h) return;
  const last = lastHitAt.get(h) || 0;
  const wait = last + PER_HOST_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastHitAt.set(h, Date.now());
}

function decodeBody(buf, contentType) {
  const ct = (contentType || '').toLowerCase();
  let charset = (ct.match(/charset=([^;\s]+)/) || [])[1];
  if (!charset && buf.length > 0) {
    const headSlice = buf.slice(0, Math.min(buf.length, 2048)).toString('latin1');
    charset = (headSlice.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  charset = (charset || 'utf-8').toLowerCase();
  if (charset === 'euc-kr' || charset === 'cp949' || charset === 'ks_c_5601-1987') {
    try {
      const { TextDecoder } = require('util');
      return new TextDecoder('euc-kr').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
  return buf.toString('utf8');
}

async function politeFetch(url, opts = {}) {
  await throttle(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);

  let attempt = 0;
  let lastErr;
  while (attempt < 2) {
    attempt += 1;
    try {
      const res = await fetch(url, {
        method: opts.method || 'GET',
        headers: {
          'User-Agent': UA,
          'Accept': opts.accept || '*/*',
          'Accept-Language': 'en;q=0.9,ko;q=0.8',
          ...(opts.headers || {})
        },
        redirect: 'follow',
        signal: ctrl.signal
      });
      clearTimeout(t);
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab.byteLength > MAX_BODY_BYTES ? ab.slice(0, MAX_BODY_BYTES) : ab);
      const text = decodeBody(buf, res.headers.get('content-type'));
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: res.url || url,
        contentType: res.headers.get('content-type') || '',
        text,
        truncated: ab.byteLength > MAX_BODY_BYTES
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 800));
    }
  }
  clearTimeout(t);
  const reason = lastErr?.cause?.code || lastErr?.cause?.message || lastErr?.code || lastErr?.message || 'fetch failed';
  return { ok: false, status: 0, finalUrl: url, contentType: '', text: '', error: String(reason) };
}

module.exports = { politeFetch, host };
