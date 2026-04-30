'use strict';

/**
 * Buyer-side verify pipeline (Phase 1A: multi-page).
 *
 * For each candidate URL:
 *   1. Fetch the homepage AND up to 5 high-signal sub-pages (/contact*,
 *      /about*, /procurement*, /vendors*, /partnerships*, /leadership*),
 *      via lib/multi-page-fetch.js.
 *   2. Regex-harvest mailto: + body emails from every fetched page.
 *   3. Pass aggregated visible text + ranked email candidates +
 *      LinkedIn hint to the LLM. The LLM picks the best emails to keep
 *      and extracts buyerType / decision-maker / employee-band / etc.
 *   4. Optional enrichment: SAM.gov + OpenCorporates lookups (Phase 3A/B).
 *   5. Build a buyer-directory entry at status 'verified' (if email +
 *      buyerType are confident) or 'raw' (needs human review).
 *
 * Falls through silently on any single-page failure — the partial result
 * still feeds the LLM. Only a homepage 4xx aborts the whole verify.
 */

const { bareHost, hostToSlug } = require('../discover-makers/lib/normalize');
const { enrichBuyer } = require('./lib/llm-extract-buyer');
const { collectBuyerInfo } = require('./lib/multi-page-fetch');
const { lookupSamGov } = require('./lib/enrich-sam-gov');
const { lookupOpenCorporates } = require('./lib/enrich-opencorporates');

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO()   { return new Date().toISOString(); }

async function verifyCandidate(candidate) {
  const collected = await collectBuyerInfo(candidate.url);
  if (!collected.ok) {
    return { ok: false, reason: collected.reason || 'fetch failed', candidate };
  }
  const host = bareHost(collected.finalUrl) || bareHost(candidate.url);
  if (!host) return { ok: false, reason: 'host parse failed', candidate };

  // Pre-compute the email hint for the LLM. Top 3 candidates.
  const emailHint = (collected.emailCandidates || []).slice(0, 3);

  let extraction = null, source = 'cf-workers-ai';
  try {
    const r = await enrichBuyer({
      url: collected.finalUrl,
      hints: collected.aggregatedHints,
      html: '<MULTIPAGE>' + collected.aggregatedText + '</MULTIPAGE>',
      extraEmailCandidates: emailHint,
      linkedinCandidate: collected.linkedinCandidate
    });
    extraction = r.enriched;
    source = r.source || 'cf-workers-ai';
    if (r.usage) {
      // eslint-disable-next-line no-console
      console.log(`ai-call: in=${r.usage.input_tokens || 0} out=${r.usage.output_tokens || 0}`);
    }
  } catch (e) {
    return { ok: false, reason: 'llm-fail: ' + e.message.slice(0, 80), candidate };
  }
  if (!extraction) return { ok: false, reason: 'llm-no-output', candidate };

  // Best email — prefer LLM's pick, but if LLM dropped it, fall back to
  // the highest-priority harvested address (procurement@/vendor@/etc).
  const c = extraction.contact || {};
  if (!c.procurementEmail && !c.primaryEmail && emailHint.length > 0) {
    const best = emailHint[0];
    // Disambiguate: harvested email goes into the procurement slot only if
    // the prefix actually says procurement / vendor / sourcing; otherwise
    // it's primaryEmail.
    if (/^procurement@|^vendors?@|^suppliers?@|^purchasing@|^sourcing@/i.test(best.email)) {
      c.procurementEmail = best.email;
    } else {
      c.primaryEmail = best.email;
    }
    extraction.contact = c;
  }
  if (!c.linkedinUrl && collected.linkedinCandidate) {
    c.linkedinUrl = collected.linkedinCandidate;
    extraction.contact = c;
  }

  // Decide initial status
  const hasEmail = !!(c.procurementEmail || c.primaryEmail);
  const hasBuyerType = extraction.buyerType && extraction.buyerType !== 'unclear';
  const status = (hasEmail && hasBuyerType) ? 'verified' : 'raw';

  const entry = {
    id: hostToSlug(host),
    legalName: extraction.legalName || (collected.aggregatedHints.ogSiteName) || '',
    displayName: extraction.displayName || (collected.aggregatedHints.ogSiteName) || (collected.aggregatedHints.title) || '',
    country: extraction.country || (host.endsWith('.kr') ? 'KR' : ''),
    region: extraction.region || '',
    sector: candidate.sectorHint || 'multi',
    buyerType: extraction.buyerType,
    homepageUrl: collected.finalUrl,
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
    lastVerifiedAt: nowISO(),
    enrichmentSources: { llm: source, pagesScanned: collected.pages.length, emailsHarvested: (collected.emailCandidates || []).length }
  };

  // Phase 3A — SAM.gov enrichment for likely-fed-procurement US entries
  const wantSam = entry.country === 'US' && (entry.buyerType === 'fed-procurement' || ['k-security','k-energy','k-bio','k-tech'].includes(entry.sector));
  if (wantSam) {
    try {
      const sam = await lookupSamGov(entry.legalName || entry.displayName || '');
      if (sam && sam.matched) {
        entry.samGov = sam;
        // If SAM has a more authoritative legal name, prefer it
        if (sam.legalBusinessName) entry.legalName = sam.legalBusinessName;
        entry.enrichmentSources.samGov = sam.source || 'sam.gov';
      }
    } catch (_) { /* best-effort */ }
  }

  // Phase 3B — OpenCorporates legal-registry cross-check (best-effort)
  try {
    const oc = await lookupOpenCorporates({ name: entry.legalName || entry.displayName, country: entry.country });
    if (oc && oc.matched) {
      entry.openCorporates = oc;
      if (!entry.headquartersAddress && oc.registeredAddress) entry.headquartersAddress = oc.registeredAddress;
      entry.enrichmentSources.openCorporates = oc.source || 'opencorporates';
    }
  } catch (_) { /* best-effort */ }

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
