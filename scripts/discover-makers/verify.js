'use strict';

/**
 * Core verify pipeline.
 *
 * Input: array of candidate objects from a seed plugin:
 *   { url, sourceLabel, sourceQuery?, sectorHint? }
 *
 * For each candidate:
 *   1. Fetch root URL (politely, throttled)
 *   2. Extract structured hints (lang, hreflang, JSON-LD, OG, meta)
 *   3. Detect English homepage (root / hreflang / /en/ / en. subdomain / toggle link)
 *   4. Build a maker-directory entry (status: 'raw'); skip on hard failure
 *
 * Output: array of entries, plus a per-candidate report for the caller to log.
 *
 * Notes:
 *  - Skips entries where the homepage can't be fetched at all
 *  - Records EVERY successfully-fetched candidate, even ones without an
 *    English homepage — those land with englishHomepageUrl="" so the user
 *    can see what was rejected and why
 *  - Country guess: 'KR' if .kr/.co.kr OR JSON-LD address says KR; else ''
 */

const { politeFetch } = require('./lib/fetch');
const { extractAll } = require('./lib/extract-hints');
const { detectEnglishHomepage } = require('./lib/lang-detect');
const { bareHost, rootUrl, hostToSlug, isProbablyKoreanHost } = require('./lib/normalize');

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }

function inferCountry(host, jsonLdCompany) {
  const c = (jsonLdCompany?.addressCountry || '').toString().toUpperCase();
  if (c === 'KR' || c.includes('KOREA')) return 'KR';
  if (isProbablyKoreanHost(host)) return 'KR';
  return c.length === 2 ? c : '';
}

function buildEntry({ candidate, fetched, hints, english }) {
  const host = bareHost(fetched.finalUrl) || bareHost(candidate.url);
  if (!host) return null;
  const id = hostToSlug(host);

  const company = hints.company || {};
  const country = inferCountry(host, company);

  const isEnRoot = english?.detectedBy === 'html-lang';
  const koreanUrl = isEnRoot ? '' : rootUrl(fetched.finalUrl);
  const englishUrl = english?.englishUrl || '';

  return {
    id,
    legalName: company.legalName || hints.ogSiteName || '',
    displayName: hints.ogSiteName || hints.title || '',
    sector: candidate.sectorHint || 'uncategorised',
    homepageHost: host,
    koreanHomepageUrl: koreanUrl,
    englishHomepageUrl: englishUrl,
    englishDetectedBy: english?.detectedBy || '',
    headquartersCountry: country,
    headquartersAddress: company.address || '',
    businessType: 'unclear',
    exportSignals: [],
    structuredDataHints: {
      jsonLdTypes: hints.jsonLdTypes || [],
      ogSiteName: hints.ogSiteName || '',
      metaDescription: hints.metaDescription || '',
      htmlLangAttr: hints.htmlLang || ''
    },
    contact: {
      email: company.email || '',
      tel: company.telephone || ''
    },
    sources: [{
      seed: candidate.sourceLabel,
      seedQuery: candidate.sourceQuery || '',
      discoveredAt: todayISO()
    }],
    status: 'raw',
    discoveredAt: todayISO(),
    lastFetchedAt: nowISO()
  };
}

async function verifyCandidate(candidate) {
  const root = rootUrl(candidate.url) || candidate.url;
  const fetched = await politeFetch(root);
  if (!fetched.ok) {
    const why = fetched.status > 0 ? `HTTP ${fetched.status}` : (fetched.error || 'fetch failed');
    return { ok: false, reason: why, candidate };
  }
  const hints = extractAll(fetched.text, fetched.finalUrl);
  const english = await detectEnglishHomepage({ rootUrl: fetched.finalUrl, hints });
  const entry = buildEntry({ candidate, fetched, hints, english });
  if (!entry) return { ok: false, reason: 'host parse failed', candidate };
  return {
    ok: true,
    entry,
    hasEnglish: Boolean(english),
    detectedBy: english?.detectedBy || ''
  };
}

async function verifyAll(candidates, { onProgress } = {}) {
  const reports = [];
  const entries = [];
  let i = 0;
  for (const c of candidates) {
    i += 1;
    const r = await verifyCandidate(c);
    reports.push(r);
    if (r.ok) entries.push(r.entry);
    if (onProgress) onProgress({ i, total: candidates.length, candidate: c, result: r });
  }
  return { entries, reports };
}

module.exports = { verifyCandidate, verifyAll };
