'use strict';

/**
 * Buyer-side verify pipeline.
 *
 * For each candidate URL from a seed plugin, fetch the homepage, run LLM
 * extraction (CF Workers AI primary, Anthropic Haiku fallback), and produce
 * a buyer-directory entry at status 'raw' (or 'verified' if extraction
 * yields a clear buyerType + primaryEmail).
 *
 * Reuses the maker-side fetch + extract-hints helpers — they're sector-
 * agnostic.
 */

const { politeFetch } = require('../discover-makers/lib/fetch');
const { extractAll } = require('../discover-makers/lib/extract-hints');
const { bareHost, hostToSlug } = require('../discover-makers/lib/normalize');
const { enrichBuyer } = require('./lib/llm-extract-buyer');

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO()   { return new Date().toISOString(); }

async function verifyCandidate(candidate) {
  const fetched = await politeFetch(candidate.url);
  if (!fetched.ok) {
    return { ok: false, reason: fetched.status > 0 ? `HTTP ${fetched.status}` : (fetched.error || 'fetch failed'), candidate };
  }

  const hints = extractAll(fetched.text, fetched.finalUrl);
  const host = bareHost(fetched.finalUrl) || bareHost(candidate.url);
  if (!host) return { ok: false, reason: 'host parse failed', candidate };

  let extraction = null, source = 'cf-workers-ai';
  try {
    const r = await enrichBuyer({ url: fetched.finalUrl, hints, html: fetched.text });
    extraction = r.enriched;
    source = r.source || 'cf-workers-ai';
    // Per-call AI usage line for the review-server live counter
    if (r.usage) {
      // eslint-disable-next-line no-console
      console.log(`ai-call: in=${r.usage.input_tokens || 0} out=${r.usage.output_tokens || 0}`);
    }
  } catch (e) {
    return { ok: false, reason: 'llm-fail: ' + e.message.slice(0, 80), candidate };
  }
  if (!extraction) return { ok: false, reason: 'llm-no-output', candidate };

  // Decide initial status — verified if we have BOTH a sensible buyerType
  // and at least one email; raw otherwise (human review needed).
  const hasEmail = !!(extraction.contact && (extraction.contact.primaryEmail || extraction.contact.procurementEmail));
  const hasBuyerType = extraction.buyerType && extraction.buyerType !== 'unclear';
  const status = (hasEmail && hasBuyerType) ? 'verified' : 'raw';

  const entry = {
    id: hostToSlug(host),
    legalName: extraction.legalName || hints.ogSiteName || '',
    displayName: extraction.displayName || hints.ogSiteName || hints.title || '',
    country: extraction.country || (host.endsWith('.kr') ? 'KR' : ''),
    region: extraction.region || '',
    sector: candidate.sectorHint || 'multi',
    buyerType: extraction.buyerType,
    homepageUrl: fetched.finalUrl,
    homepageHost: host,
    headquartersAddress: extraction.headquartersAddress || '',
    employeeSizeBand: extraction.employeeSizeBand,
    annualRevenueBand: extraction.annualRevenueBand,
    primaryProductInterest: extraction.primaryProductInterest || [],
    knownTradeHistoryWithKorea: !!extraction.knownTradeHistoryWithKorea,
    contact: extraction.contact || {},
    sources: [{
      seed: candidate.sourceLabel,
      seedQuery: candidate.sourceQuery || '',
      discoveredAt: todayISO()
    }],
    status,
    discoveredAt: todayISO(),
    lastVerifiedAt: nowISO()
  };
  return { ok: true, entry, hasBuyerType, hasEmail, source };
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
