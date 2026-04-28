'use strict';

/**
 * URL/host normalisation + dedup keys for maker-directory entries.
 *
 * One entry per "homepage host" — we strip leading 'www.', lowercase, drop port.
 * The dedup key (host) is what makes seed plugins idempotent.
 */

function bareHost(url) {
  try {
    const h = new URL(url).host.toLowerCase();
    return h.replace(/^www\./, '').replace(/:\d+$/, '');
  } catch { return ''; }
}

function rootUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch { return url; }
}

function sameHost(a, b) {
  return bareHost(a) && bareHost(a) === bareHost(b);
}

function isProbablyKoreanHost(host) {
  if (!host) return false;
  if (host.endsWith('.kr') || host.endsWith('.co.kr') || host.endsWith('.korea')) return true;
  return false;
}

/**
 * Slugify a host into a stable id: 'cosmax.com' -> 'cosmax-com'.
 * Long subdomain hosts are kept as-is (replacing dots with dashes) — a uniqueness wins over brevity.
 */
function hostToSlug(host) {
  return host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { bareHost, rootUrl, sameHost, isProbablyKoreanHost, hostToSlug };
