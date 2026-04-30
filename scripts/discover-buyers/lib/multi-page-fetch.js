'use strict';

/**
 * Multi-page buyer-info collector.
 *
 * For a given root URL, fetches the homepage and follows up to N anchors
 * pointing to the high-signal pages where buyer contact info actually
 * lives:  /contact*, /about*, /procurement*, /vendors*, /partnerships*,
 * /leadership*, /team*. Then regex-harvests email addresses from ALL
 * fetched pages so the LLM can pick the best one to keep.
 *
 * Output shape:
 *   {
 *     pages: [{ url, kind, status, text }, ...],
 *     aggregatedText: string,         // concat of visible text, capped
 *     aggregatedHints: object,        // homepage hints (title / og / lang)
 *     emailCandidates: [{ email, source, kind }, ...],
 *     linkedinCandidate: string,
 *     finalUrl: string                // homepage's final URL after redirects
 *   }
 *
 * Failures are silent: a page that 404s or times out is skipped, the rest
 * still feed the LLM. Polite throttling reuses politeFetch's per-host gap.
 */

const { politeFetch } = require('../../discover-makers/lib/fetch');
const { extractAll } = require('../../discover-makers/lib/extract-hints');

// Patterns whose URL path (after the host) hints at buyer-info pages.
// Each pattern includes a `kind` tag that the LLM can use to weight the
// content (e.g., contact pages are best for emails; about pages best for
// decision-makers).
const PATH_PATTERNS = [
  { kind: 'contact',       re: /\/(contact|contact-us|contactus|reach-us|get-in-touch)(\/|\.html?|$)/i },
  { kind: 'about',         re: /\/(about|about-us|aboutus|company|who-we-are)(\/|\.html?|$)/i },
  { kind: 'procurement',   re: /\/(procurement|procurements)(\/|\.html?|$)/i },
  { kind: 'vendor',        re: /\/(vendor|vendors|supplier|suppliers|sourcing)(\/|\.html?|$)/i },
  { kind: 'partner',       re: /\/(partner|partners|partnership|partnerships)(\/|\.html?|$)/i },
  { kind: 'leadership',    re: /\/(leadership|management|team|executives|leaders)(\/|\.html?|$)/i },
  { kind: 'wholesale',     re: /\/(wholesale|b2b|bulk|distribution)(\/|\.html?|$)/i }
];

const MAX_FOLLOW = 5;            // cap extra page fetches
const TEXT_BUDGET_PER_PAGE = 4000;
const TOTAL_TEXT_BUDGET = 10000;

// Email priority — the best email to put on the buyer card. Higher score wins.
const PRIORITY_PREFIX = [
  { p: /^procurement@/i, w: 100 },
  { p: /^vendors?@/i,    w: 90 },
  { p: /^suppliers?@/i,  w: 88 },
  { p: /^purchasing@/i,  w: 86 },
  { p: /^sourcing@/i,    w: 84 },
  { p: /^partnerships?@/i, w: 70 },
  { p: /^business@/i,    w: 66 },
  { p: /^sales@/i,       w: 60 },
  { p: /^wholesale@/i,   w: 58 },
  { p: /^b2b@/i,         w: 55 },
  { p: /^enquiries?@/i,  w: 50 },
  { p: /^inquiries?@/i,  w: 50 },
  { p: /^contact@/i,     w: 40 },
  { p: /^info@/i,        w: 30 },
  { p: /^hello@/i,       w: 25 },
  { p: /^press@/i,       w: 10 },
  { p: /^media@/i,       w: 10 },
  { p: /^careers?@/i,    w: 5 },
  { p: /^jobs?@/i,        w: 5 },
  { p: /^webmaster@/i,   w: 1 },
  { p: /^noreply@/i,     w: 0 },
  { p: /^do-?not-?reply@/i, w: 0 }
];

function emailScore(email) {
  for (const { p, w } of PRIORITY_PREFIX) if (p.test(email)) return w;
  return 35; // unknown prefix — better than press/info but worse than sales
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ -]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function harvestEmails(html, pageUrl) {
  const out = [];
  const seen = new Set();
  // 1) Explicit mailto: links — strongest signal
  const mailtoRe = /<a[^>]+href\s*=\s*["']mailto:([^"'?]+)/gi;
  let m;
  while ((m = mailtoRe.exec(html))) {
    const e = m[1].toLowerCase().trim();
    if (!isPlausibleEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push({ email: e, source: 'mailto', pageUrl });
  }
  // 2) Plain-text emails in body — weaker, but catches footer / contact blocks
  const text = htmlToText(html);
  const bodyRe = /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g;
  let m2;
  while ((m2 = bodyRe.exec(text))) {
    const e = m2[1].toLowerCase().trim();
    if (!isPlausibleEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push({ email: e, source: 'body', pageUrl });
  }
  return out;
}

function isPlausibleEmail(e) {
  if (!e || e.length > 120) return false;
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(e)) return false;
  // Exclude obvious test / placeholder emails
  if (/example\.com$|test\.com$|localhost|@yourdomain|@domain\./i.test(e)) return false;
  // Exclude image / asset filenames that match the regex
  if (/@.*\.(png|jpg|gif|svg)$/i.test(e)) return false;
  return true;
}

function scoreEmailDomainMatch(email, hostHint) {
  if (!hostHint) return 0;
  const host = hostHint.replace(/^www\./, '');
  const emailDomain = email.split('@')[1] || '';
  if (emailDomain === host) return 50;
  if (emailDomain.endsWith('.' + host)) return 30;
  // Cross-host email is still useful but lower confidence
  return -20;
}

function pickBestEmails(emailCandidates, hostHint, max = 3) {
  return emailCandidates
    .map(c => ({
      ...c,
      score: emailScore(c.email) + scoreEmailDomainMatch(c.email, hostHint) + (c.source === 'mailto' ? 10 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

function pickPathKind(url) {
  for (const p of PATH_PATTERNS) if (p.re.test(url)) return p.kind;
  return null;
}

function collectFollowCandidates(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { continue; }
    abs = abs.replace(/#.*$/, '');
    // Same-host only (don't follow externals like LinkedIn — we capture those separately)
    let baseHost, candHost;
    try { baseHost = new URL(baseUrl).host.toLowerCase().replace(/^www\./, ''); } catch { continue; }
    try { candHost = new URL(abs).host.toLowerCase().replace(/^www\./, ''); } catch { continue; }
    if (baseHost !== candHost) continue;
    if (seen.has(abs)) continue;
    const kind = pickPathKind(abs);
    if (!kind) continue;
    seen.add(abs);
    out.push({ url: abs, kind });
  }
  // Dedup by kind — keep first hit per kind so we don't fetch /contact AND /contact-us
  const byKind = new Map();
  for (const c of out) if (!byKind.has(c.kind)) byKind.set(c.kind, c);
  return Array.from(byKind.values()).slice(0, MAX_FOLLOW);
}

function findLinkedin(html) {
  const m = html.match(/href\s*=\s*["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[^"']+)["']/i);
  return m ? m[1] : '';
}

/**
 * Sitemap.xml fallback — when homepage anchors don't surface enough
 * /contact /about candidates, parse the site's sitemap.xml (if any) and
 * lift URLs whose path matches our high-signal patterns. Best-effort.
 */
async function followCandidatesFromSitemap(rootUrl, knownHosts) {
  const out = [];
  let abs;
  try { abs = new URL('/sitemap.xml', rootUrl).href; } catch { return out; }
  const r = await politeFetch(abs);
  if (!r.ok) return out;
  const seen = new Set();
  // Single-level sitemap: read <loc>URL</loc> entries
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(r.text))) {
    const u = m[1];
    let host;
    try { host = new URL(u).host.toLowerCase().replace(/^www\./, ''); } catch { continue; }
    if (knownHosts && !knownHosts.has(host)) continue;
    const kind = pickPathKind(u);
    if (!kind) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, kind });
  }
  // Dedup by kind
  const byKind = new Map();
  for (const c of out) if (!byKind.has(c.kind)) byKind.set(c.kind, c);
  return Array.from(byKind.values());
}

/**
 * Top-level entry — given a root URL, return the multi-page collection.
 */
async function collectBuyerInfo(rootUrl) {
  const homeFetch = await politeFetch(rootUrl);
  if (!homeFetch.ok) {
    return { pages: [], aggregatedText: '', aggregatedHints: {}, emailCandidates: [], linkedinCandidate: '', finalUrl: rootUrl, ok: false, reason: homeFetch.error || `HTTP ${homeFetch.status}` };
  }
  const homeUrl = homeFetch.finalUrl || rootUrl;
  const homeHints = extractAll(homeFetch.text, homeUrl);
  const homeText = htmlToText(homeFetch.text).slice(0, TEXT_BUDGET_PER_PAGE);
  const allEmails = harvestEmails(homeFetch.text, homeUrl);
  const linkedin = findLinkedin(homeFetch.text);

  const pages = [{ url: homeUrl, kind: 'home', status: homeFetch.status, text: homeText }];
  const followers = collectFollowCandidates(homeFetch.text, homeUrl);

  // Sitemap.xml fallback — if homepage anchors only got us 0-1 follow
  // candidates, look at sitemap for additional /contact /about / etc.
  if (followers.length < 2) {
    let host = '';
    try { host = new URL(homeUrl).host.toLowerCase().replace(/^www\./, ''); } catch (_) {}
    const sm = await followCandidatesFromSitemap(homeUrl, host ? new Set([host]) : null);
    const seenKinds = new Set(followers.map(f => f.kind));
    for (const c of sm) if (!seenKinds.has(c.kind) && followers.length < MAX_FOLLOW) followers.push(c);
  }

  // Fetch each follow candidate.
  for (const c of followers) {
    const r = await politeFetch(c.url);
    if (!r.ok) continue;
    const t = htmlToText(r.text).slice(0, TEXT_BUDGET_PER_PAGE);
    pages.push({ url: r.finalUrl || c.url, kind: c.kind, status: r.status, text: t });
    for (const e of harvestEmails(r.text, r.finalUrl || c.url)) allEmails.push(e);
  }

  // Aggregate text under a hard budget so the LLM prompt stays small
  let combined = '';
  for (const p of pages) {
    const block = `\n\n[${p.kind.toUpperCase()} · ${p.url}]\n${p.text}`;
    if (combined.length + block.length > TOTAL_TEXT_BUDGET) {
      combined += block.slice(0, TOTAL_TEXT_BUDGET - combined.length);
      break;
    }
    combined += block;
  }

  const hostHint = (() => { try { return new URL(homeUrl).host.toLowerCase().replace(/^www\./, ''); } catch { return ''; } })();
  const ranked = pickBestEmails(allEmails, hostHint, 6);

  return {
    pages,
    aggregatedText: combined.trim(),
    aggregatedHints: homeHints,
    emailCandidates: ranked,
    linkedinCandidate: linkedin,
    finalUrl: homeUrl,
    ok: true
  };
}

module.exports = { collectBuyerInfo, harvestEmails, pickBestEmails, htmlToText };
