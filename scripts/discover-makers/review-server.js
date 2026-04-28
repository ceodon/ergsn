#!/usr/bin/env node
'use strict';

/**
 * review-server.js — local-only HTTP server that serves review.html and
 * proxies read/write of data/maker-directory.json.
 *
 * Why a server (not a static HTML file)?  The browser cannot write back to
 * a local JSON file from a file:// page. A 60-line Node server fixes that
 * cleanly and keeps everything under the project root with no extra deps.
 *
 * Usage:
 *   node scripts/discover-makers/review-server.js
 *   npm run review:makers
 *
 * Then open http://127.0.0.1:5174 in your browser.
 *
 * Endpoints:
 *   GET  /                       → review.html
 *   GET  /api/makers             → full directory JSON
 *   POST /api/makers/:id         → patch one entry's mutable fields:
 *                                    { status, sector, notes, rejectedReason }
 *
 * Safety:
 *   - Bound to 127.0.0.1 only (no LAN exposure)
 *   - Only the four mutable fields above can be patched; everything else
 *     is read-only (so verification cannot accidentally clobber LLM output)
 *   - Writes use the existing persistence helper, which keeps formatting
 *     identical to the discovery-mode writes
 */

// Load .env so /api/makers/:id/discover-products has CF Workers AI creds
require('./lib/dotenv').loadDotEnv();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const persistence = require('./lib/persistence');
const productPersistence = require('./lib/persistence-products');
const productsStore = require('./lib/products-store');
const { syncFromProducts } = require('./lib/sync-from-products');
const { syncErgsnSelf } = require('./lib/sync-ergsn-self');
const { discoverForMaker } = require('./lib/product-discover');
const { extractProductDetail } = require('./lib/product-extract-detail');
const { downloadAndProcess } = require('./lib/image-pipeline');
const { promote: promoteToContacts, isPromoted } = require('./lib/promote-to-contacts');
const { notifyPromote, notifyProductRegistered } = require('./lib/notify-telegram');
const manualSeed = require('./seeds/manual');
const searchSeed = require('./seeds/search');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DISCOVER_JS = path.join(REPO_ROOT, 'scripts', 'discover-makers', 'discover.js');

const PORT = Number(process.env.REVIEW_PORT) || 5174;
const HOST = '127.0.0.1';
const HTML_PATH = path.resolve(__dirname, 'review.html');
const FAVICON_PATH = path.resolve(REPO_ROOT, 'favicon.svg');
const ALLOWED_STATUS = new Set(['raw', 'verified', 'pending', 'rejected', 'contacted', 'onboarded']);
const ALLOWED_SEEDS = new Set(['manual', 'search']);
const ALLOWED_MODES = new Set(['discover', 'enrich']);

// In-memory crawl jobs. Lost on server restart — that's fine because the
// real result lands in data/maker-directory.json which is persistent.
const crawlJobs = new Map();
let crawlSeq = 0;

// Track CF Workers AI daily-quota state. When we see the 10,000-Neuron
// rejection in any LLM response (enrich, discover-products), mark it
// exceeded so the UI can disable the Crawl/Discover buttons. Auto-clears
// 24 hours later (CF's free-tier resets daily).
const aiState = { exceededAt: 0, reason: '' };

// Daily AI usage counter (per UTC day). The UI surfaces this as a countdown
// so the user can see how much of the 10,000-Neuron daily budget remains.
// CF doesn't return Neurons-per-call, only token usage; we approximate
// Neurons by NEURONS_PER_CALL (calibrated below). The aiState.exceeded
// boolean above is the authoritative block — this counter is for
// situational awareness, not enforcement.
const AI_DAILY_BUDGET_NEURONS = 10000;
// Each Llama-3.1-8B call on Workers AI consumes roughly 2-5 Neurons depending
// on prompt + completion size. We use 3 as a conservative midpoint. If the
// counter says "0 left" while CF still allows, the boolean below stays false;
// if CF blocks earlier than the counter expects, the boolean flips and the
// pill turns red regardless of the counter.
const NEURONS_PER_CALL = 3;
const aiUsage = { dayKey: '', calls: 0, tokens: 0 };

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function rollAiUsageIfNewDay() {
  const k = utcDayKey();
  if (aiUsage.dayKey !== k) {
    aiUsage.dayKey = k;
    aiUsage.calls = 0;
    aiUsage.tokens = 0;
  }
}

function noteAiCall(usage) {
  rollAiUsageIfNewDay();
  aiUsage.calls += 1;
  if (usage && typeof usage === 'object') {
    aiUsage.tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
  }
}

function isAiQuotaError(text) {
  if (!text) return false;
  return /you have used up your daily free allocation/i.test(text)
      || /\b10,?000\s*neurons?\b/i.test(text)
      || /workers ai 429/i.test(text);
}

function noteAiState(line) {
  if (isAiQuotaError(line)) {
    aiState.exceededAt = Date.now();
    aiState.reason = 'CF Workers AI daily 10,000 Neurons exhausted';
  }
}

function aiQuotaSnapshot() {
  if (!aiState.exceededAt) return { exceeded: false };
  // Auto-clear 24h after the first sighting (CF free-tier resets daily).
  // The user can also re-try sooner — a successful call will not reset
  // automatically because we only update on errors.
  const RESET_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - aiState.exceededAt > RESET_MS) {
    aiState.exceededAt = 0; aiState.reason = '';
    return { exceeded: false };
  }
  const resetsAt = new Date(aiState.exceededAt + RESET_MS).toISOString();
  return { exceeded: true, since: new Date(aiState.exceededAt).toISOString(), resetsAt, reason: aiState.reason };
}

function startCrawl({ seed, sector, mode, refresh, max }) {
  const id = 'job-' + (++crawlSeq).toString(36) + '-' + Date.now().toString(36);
  const args = [DISCOVER_JS, `--seed=${seed}`];
  if (mode === 'enrich') args.push('--enrich');
  if (sector === '__all__') args.push('--all-sectors');
  else if (sector) args.push(`--sector=${sector}`);
  if (refresh) args.push('--refresh');
  if (max) args.push(`--max=${max}`);

  const job = {
    id,
    seed, sector, mode,
    refresh: !!refresh,
    max: max || null,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    error: null,
    lines: [],
    counts: { fetched: 0, en: 0, failed: 0, added: 0, updated: 0, enriched: 0, enrichFailed: 0 }
  };
  crawlJobs.set(id, job);

  const child = spawn(process.execPath, args, { cwd: REPO_ROOT });
  job.pid = child.pid;
  const onData = (buf) => {
    const lines = buf.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      job.lines.push(line);
      if (job.lines.length > 1000) job.lines.splice(0, job.lines.length - 1000);
      noteAiState(line);
      // parse summary tokens
      let m;
      if ((m = line.match(/persisted:\s*\+?(\d+)\s*new,\s*(\d+)\s*updated/i))) {
        job.counts.added = parseInt(m[1], 10);
        job.counts.updated = parseInt(m[2], 10);
      }
      if ((m = line.match(/persisted:\s*(\d+)\s*updated/i))) {
        job.counts.updated = parseInt(m[1], 10);
      }
      if ((m = line.match(/summary:\s*(\d+)\s*fetched\s*·\s*(\d+)\s*with\s*English/i))) {
        job.counts.fetched = parseInt(m[1], 10);
        job.counts.en = parseInt(m[2], 10);
      }
      if ((m = line.match(/summary:\s*(\d+)\s*enriched\s*·\s*(\d+)\s*failed/i))) {
        job.counts.enriched = parseInt(m[1], 10);
        job.counts.enrichFailed = parseInt(m[2], 10);
      }
      // Subprocess emits one `ai-call: in=N out=M` per LLM request — sum into
      // the daily counter so the UI countdown reflects in-flight enrich runs.
      if ((m = line.match(/^ai-call:\s*in=(\d+)\s+out=(\d+)/i))) {
        noteAiCall({ input_tokens: parseInt(m[1], 10), output_tokens: parseInt(m[2], 10) });
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', (b) => onData(Buffer.from(b.toString().split(/\r?\n/).map(l => l ? '! ' + l : l).join('\n'))));
  child.on('error', (err) => {
    job.error = err.message;
    job.status = 'error';
    job.finishedAt = new Date().toISOString();
  });
  child.on('exit', (code) => {
    job.exitCode = code;
    job.status = code === 0 ? 'done' : 'error';
    job.finishedAt = new Date().toISOString();
  });
  return job;
}
const ALLOWED_PRODUCT_STATUS = new Set(['candidate', 'saved', 'discarded', 'registered']);
const ALLOWED_SECTORS = new Set([
  'k-security', 'k-tech', 'k-energy', 'k-bio', 'k-beauty',
  'k-culture-goods', 'k-franchise', 'k-smart-living', 'k-tourism-assets',
  'uncategorised'
]);

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

function serveHtml(res) {
  fs.readFile(HTML_PATH, (err, buf) => {
    if (err) { send404(res); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 8192) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Only accept connections from this machine. Belt-and-braces beyond bind addr.
  const remote = req.socket.remoteAddress;
  if (remote && remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
    res.writeHead(403); res.end('forbidden'); return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/review.html')) {
    return serveHtml(res);
  }

  // Favicon — serve the same SVG mark used on ergsn.net so the browser tab
  // shows the brand instead of an empty square.
  if (req.method === 'GET' && (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico')) {
    fs.readFile(FAVICON_PATH, (err, buf) => {
      if (err) { send404(res); return; }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'Content-Length': buf.length });
      res.end(buf);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/makers') {
    // Inject per-maker registered/candidate counts AND the origin classification
    // so the card can render badges + the global stats counter can group makers.
    const obj = persistence.read();
    const candidates = productPersistence.read().products;
    const candByMaker = new Map();
    for (const c of candidates) {
      const list = candByMaker.get(c.makerId) || [];
      list.push(c);
      candByMaker.set(c.makerId, list);
    }
    // Origin = where the maker first entered the directory.
    //   existing  — products.json sync, owner-known sync, manual + Add maker UI
    //   discovered — manual seed list, search seed (Tavily)
    function classifyOrigin(m) {
      const seed = (m.sources && m.sources[0] && m.sources[0].seed) || '';
      if (seed === 'products.json' || seed === 'owner-known' || seed === 'manual:add-ui') return 'existing';
      return 'discovered';
    }
    // Build a quick lookup of which makers are already in
    // data/maker-contacts.json so the card can render the badge. We match on
    // both id (newer slugs like `mfg-cosmedique-co-ltd`) AND legalName
    // (legacy ids like `cosmedique` that pre-date the directory rename).
    const contactsIds = new Set();
    const contactsLegalNames = new Set();
    try {
      const cc = require('./lib/promote-to-contacts').read();
      for (const x of cc.makers) {
        if (x.id) contactsIds.add(x.id);
        if (x.legalName) contactsLegalNames.add(x.legalName.toLowerCase().trim());
      }
    } catch (_) {}
    for (const m of obj.makers) {
      const reg = productsStore.listForMaker(m);
      const cand = candByMaker.get(m.id) || [];
      m._counts = {
        registered: reg.length,
        candidates: cand.filter(c => c.status === 'candidate').length,
        saved: cand.filter(c => c.status === 'saved').length,
        discarded: cand.filter(c => c.status === 'discarded').length
      };
      m._origin = classifyOrigin(m);
      m._promoted = contactsIds.has(m.id)
        || (m.legalName && contactsLegalNames.has(m.legalName.toLowerCase().trim()));
    }
    return sendJson(res, 200, obj);
  }

  // Combined product list for one maker — registered (data/products.json) + candidates
  const mMprod = url.pathname.match(/^\/api\/maker-products\/([^/]+)$/);
  if (mMprod && req.method === 'GET') {
    const id = decodeURIComponent(mMprod[1]);
    const obj = persistence.read();
    const maker = obj.makers.find(x => x.id === id);
    if (!maker) return sendJson(res, 404, { ok: false, error: 'unknown maker id' });
    const registered = productsStore.listForMaker(maker);
    const candidates = productPersistence.listForMaker(id);
    return sendJson(res, 200, { ok: true, maker, registered, candidates });
  }

  // Create new maker (manual add via UI)
  if (req.method === 'POST' && url.pathname === '/api/makers') {
    let body;
    try { body = await parseBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const legalName = String(body.legalName || '').trim().slice(0, 200);
    if (!legalName) return sendJson(res, 400, { ok: false, error: 'legalName required' });
    const sector = String(body.sector || 'uncategorised');
    if (!ALLOWED_SECTORS.has(sector)) return sendJson(res, 400, { ok: false, error: 'bad sector' });
    const status = String(body.status || 'verified');
    if (!ALLOWED_STATUS.has(status)) return sendJson(res, 400, { ok: false, error: 'bad status' });
    const homepage = String(body.homepageUrl || '').trim();
    let homepageHost = '';
    try { if (homepage) homepageHost = new URL(homepage).host.toLowerCase().replace(/^www\./, ''); } catch (_) {}

    const slug = (legalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'maker').slice(0, 60);
    let id = 'mfg-' + slug;
    const obj = persistence.read();
    let n = 1;
    while (obj.makers.find(m => m.id === id)) { id = 'mfg-' + slug + '-' + (++n); }

    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      id,
      legalName,
      displayName: legalName,
      sector,
      homepageHost,
      koreanHomepageUrl: homepage,
      englishHomepageUrl: homepage,
      englishDetectedBy: 'manual',
      headquartersCountry: 'KR',
      headquartersAddress: '',
      businessType: 'manufacturer',
      exportSignals: [],
      structuredDataHints: { jsonLdTypes: [], ogSiteName: '', metaDescription: '', htmlLangAttr: '' },
      contact: {},
      social: {},
      sources: [{ seed: 'manual:add-ui', seedQuery: '', discoveredAt: today }],
      status,
      contractSigned: !!body.contractSigned,
      contractDate: body.contractSigned ? today : '',
      discoveredAt: today,
      lastFetchedAt: new Date().toISOString(),
      notes: String(body.notes || '').slice(0, 500)
    };
    obj.makers.push(entry);
    persistence.write(obj);
    return sendJson(res, 200, { ok: true, entry });
  }

  // Patch one maker
  const mMaker = url.pathname.match(/^\/api\/makers\/([^/]+)$/);
  if (mMaker && req.method === 'POST') {
    const id = decodeURIComponent(mMaker[1]);
    let body;
    try { body = await parseBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad json' }); }

    const obj = persistence.read();
    const entry = obj.makers.find(x => x.id === id);
    if (!entry) return sendJson(res, 404, { ok: false, error: 'unknown id' });

    if (typeof body.status === 'string') {
      if (!ALLOWED_STATUS.has(body.status)) return sendJson(res, 400, { ok: false, error: 'bad status' });
      entry.status = body.status;
    }
    if (typeof body.sector === 'string') {
      if (!ALLOWED_SECTORS.has(body.sector)) return sendJson(res, 400, { ok: false, error: 'bad sector' });
      entry.sector = body.sector;
    }
    if (typeof body.notes === 'string') entry.notes = body.notes.slice(0, 1000);
    if (typeof body.rejectedReason === 'string') entry.rejectedReason = body.rejectedReason.slice(0, 200);
    let promoted = false, notified = null;
    if (typeof body.contractSigned === 'boolean') {
      const wasContracted = !!entry.contractSigned;
      entry.contractSigned = body.contractSigned;
      if (body.contractSigned && !entry.contractDate) {
        entry.contractDate = new Date().toISOString().slice(0, 10);
      }
      if (!body.contractSigned) entry.contractDate = '';
      // First time toggling on → promote to contacts + Telegram
      if (body.contractSigned && !wasContracted) {
        try {
          const result = promoteToContacts(entry);
          promoted = result.action;       // 'created' or 'updated'
          notified = await notifyPromote(entry);
        } catch (e) {
          // Don't block the contract toggle — surface the error in the response
          notified = { ok: false, error: e.message };
        }
      }
    }

    entry.lastVerifiedAt = new Date().toISOString().slice(0, 10);
    persistence.write(obj);
    return sendJson(res, 200, { ok: true, entry, promoted, notified });
  }

  // Manual promote button — same logic as the auto-promote on contract toggle,
  // but lets the user push a maker into contacts.json without flipping the
  // contractSigned flag. Useful when contact info is solid but contract is
  // still in negotiation.
  const mPromote = url.pathname.match(/^\/api\/makers\/([^/]+)\/promote$/);
  if (mPromote && req.method === 'POST') {
    const id = decodeURIComponent(mPromote[1]);
    const obj = persistence.read();
    const entry = obj.makers.find(x => x.id === id);
    if (!entry) return sendJson(res, 404, { ok: false, error: 'unknown id' });
    let result, notified;
    try {
      result = promoteToContacts(entry);
      notified = await notifyPromote(entry);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
    return sendJson(res, 200, { ok: true, action: result.action, contactsRow: result.row, notified });
  }

  // Discover products for one maker — runs LLM, may take 10-30s
  const mDisc = url.pathname.match(/^\/api\/makers\/([^/]+)\/discover-products$/);
  if (mDisc && req.method === 'POST') {
    const id = decodeURIComponent(mDisc[1]);
    const obj = persistence.read();
    const maker = obj.makers.find(x => x.id === id);
    if (!maker) return sendJson(res, 404, { ok: false, error: 'unknown id' });
    try {
      const result = await discoverForMaker(maker);
      // Reflect AI quota errors so the UI disables LLM-based actions
      for (const err of (result.errors || [])) noteAiState(err.error || '');
      // Bump the daily AI usage counter so the countdown pill stays accurate
      for (const call of (result.aiCalls || [])) noteAiCall(call.usage);
      // Persist newly-found candidates so they survive page reload
      if (result.products.length) productPersistence.upsertMany(result.products);
      // Always include the merged "live" product list for this maker
      const live = productPersistence.listForMaker(maker.id);
      return sendJson(res, 200, { ok: true, ...result, live });
    } catch (e) {
      noteAiState(e.message || '');
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // AI-quota snapshot for the UI — boolean exceeded state PLUS the daily
  // approximate counter so the front-end can render the countdown pill.
  if (req.method === 'GET' && url.pathname === '/api/limits') {
    rollAiUsageIfNewDay();
    const snap = aiQuotaSnapshot();
    snap.callsToday = aiUsage.calls;
    snap.tokensToday = aiUsage.tokens;
    snap.estimatedNeuronsToday = aiUsage.calls * NEURONS_PER_CALL;
    snap.budget = AI_DAILY_BUDGET_NEURONS;
    snap.dayKey = aiUsage.dayKey;
    return sendJson(res, 200, { ok: true, ai: snap });
  }

  // List products for one maker (used to refresh UI after re-discovery / status change)
  const mList = url.pathname.match(/^\/api\/makers\/([^/]+)\/products$/);
  if (mList && req.method === 'GET') {
    const id = decodeURIComponent(mList[1]);
    return sendJson(res, 200, { ok: true, products: productPersistence.listForMaker(id) });
  }

  // Patch one product candidate (status / notes)
  const mProd = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (mProd && req.method === 'POST') {
    const id = decodeURIComponent(mProd[1]);
    let body;
    try { body = await parseBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const patch = {};
    if (typeof body.status === 'string') {
      if (!ALLOWED_PRODUCT_STATUS.has(body.status)) return sendJson(res, 400, { ok: false, error: 'bad status' });
      patch.status = body.status;
    }
    if (typeof body.notes === 'string') patch.notes = body.notes;
    const updated = productPersistence.patch(id, patch);
    if (!updated) return sendJson(res, 404, { ok: false, error: 'unknown product id' });
    return sendJson(res, 200, { ok: true, product: updated });
  }

  // Register a candidate into data/products.json (live catalog).
  // This is the heavy path: fetches the detail page, runs CF Workers AI to
  // extract specs/features/moq/lead/price/tags/scale/cardTag/matchDesc, and
  // downloads + sharp-resizes hero images to images/products/<slug>.{jpg,webp}.
  // Result is a near-complete row that needs only minor user touch-up.
  const mReg = url.pathname.match(/^\/api\/products\/([^/]+)\/register$/);
  if (mReg && req.method === 'POST') {
    const candId = decodeURIComponent(mReg[1]);
    const candObj = productPersistence.read();
    const cand = candObj.products.find(p => p.id === candId);
    if (!cand) return sendJson(res, 404, { ok: false, error: 'unknown candidate' });
    const makerObj = persistence.read();
    const maker = makerObj.makers.find(m => m.id === cand.makerId);
    if (!maker) return sendJson(res, 404, { ok: false, error: 'unknown maker for candidate' });

    // 1) Slug-based id derived from product name; collision-suffixed if needed.
    const baseSlug = cand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'product';
    let slug = baseSlug;
    let n = 1;
    while (productsStore.byProductId(slug)) { slug = baseSlug + '-' + (++n); }

    // 2) Detail page → LLM-extracted spec block
    let extracted = null, extractErrors = [];
    try {
      const det = await extractProductDetail(cand.url);
      extracted = det.extracted;
      extractErrors = det.errors || [];
      // also reflect any AI quota error so the UI updates the limit pill
      for (const er of extractErrors) noteAiState(er.error || '');
      // Count this LLM call against the daily AI budget
      for (const call of (det.aiCalls || [])) noteAiCall(call.usage);
      var imageUrls = det.imageUrls || [];
    } catch (e) {
      noteAiState(e.message || '');
      extractErrors.push({ stage: 'extract', error: e.message });
      var imageUrls = [];
    }

    // 3) Image pipeline (download + sharp). Falls back to candidate.imageUrl
    // if detail-page hero discovery missed.
    let imgResult = { ok: false, primaryRel: '', all: [] };
    const allImageCandidates = imageUrls.length ? imageUrls : (cand.imageUrl ? [cand.imageUrl] : []);
    if (allImageCandidates.length) {
      try { imgResult = await downloadAndProcess(slug, allImageCandidates); }
      catch (e) { extractErrors.push({ stage: 'image', error: e.message }); }
    }

    // 4) Build the rich row — extracted fields take precedence, candidate
    // metadata fills any gaps, conservative defaults for the rest.
    const newProduct = {
      id: slug,
      makerId: maker.id,
      candidateId: candId,
      sector: maker.sector !== 'uncategorised' ? maker.sector : 'uncategorised',
      active: true,
      model: cand.name,
      part: cand.name.replace(/[^a-z0-9]+/gi, '-').toUpperCase().slice(0, 32),
      sub: (extracted && extracted.sub) || (cand.description ? cand.description.slice(0, 90) : cand.name),
      desc: (extracted && extracted.longDesc) || cand.description || cand.name,
      img: imgResult.primaryRel || '',
      specs: (extracted && extracted.specs) || [],
      features: (extracted && extracted.features) || [],
      tags: (extracted && extracted.tags) || [],
      scale: (extracted && extracted.scale) || [],
      maker: maker.legalName || maker.displayName || maker.homepageHost,
      cardTag: (extracted && extracted.cardTag) || '',
      matchDesc: (extracted && extracted.matchDesc) || (cand.description ? cand.description.slice(0, 80) : cand.name),
      sourceUrl: cand.url
    };
    if (extracted && extracted.moq > 0) newProduct.moq = extracted.moq;
    if (extracted && extracted.leadMin > 0) newProduct.leadMin = extracted.leadMin;
    if (extracted && extracted.leadMax > 0) newProduct.leadMax = extracted.leadMax;
    if (extracted && extracted.priceLow > 0) newProduct.priceLow = extracted.priceLow;
    if (extracted && extracted.priceHigh > 0) newProduct.priceHigh = extracted.priceHigh;

    try { productsStore.add(newProduct); }
    catch (e) { return sendJson(res, 409, { ok: false, error: e.message }); }
    productPersistence.patch(candId, { status: 'registered' });
    if (maker.status !== 'onboarded' && maker.status !== 'rejected') {
      maker.status = 'onboarded';
      maker.lastVerifiedAt = new Date().toISOString().slice(0, 10);
      persistence.write(makerObj);
    }

    // If maker is already promoted to contacts, refresh productsRegistered
    let promotedRefresh = null;
    if (isPromoted(maker.id)) {
      try { promotedRefresh = promoteToContacts(maker).action; } catch (_) {}
    }

    // Telegram notification — best-effort, never blocks the response
    let notified = null;
    try { notified = await notifyProductRegistered(maker, newProduct); }
    catch (e) { notified = { ok: false, error: e.message }; }

    return sendJson(res, 200, {
      ok: true,
      product: newProduct,
      candidateId: candId,
      enriched: !!extracted,
      images: { tried: allImageCandidates.length, saved: imgResult.all.filter(x => x.ok).length, primary: imgResult.primaryRel },
      promoted: promotedRefresh,
      notified,
      errors: extractErrors
    });
  }

  // ─── Crawl trigger ───────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/crawl/start') {
    let body;
    try { body = await parseBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const seed = String(body.seed || '');
    const sector = String(body.sector || '__all__');
    const mode = String(body.mode || 'discover');
    if (!ALLOWED_SEEDS.has(seed)) return sendJson(res, 400, { ok: false, error: 'bad seed' });
    if (!ALLOWED_MODES.has(mode)) return sendJson(res, 400, { ok: false, error: 'bad mode' });
    if (sector !== '__all__') {
      const sectors = (seed === 'search' ? searchSeed : manualSeed).availableSectors();
      if (!sectors.includes(sector)) return sendJson(res, 400, { ok: false, error: 'bad sector' });
    }
    const refresh = mode === 'enrich' ? !!body.refresh : false;
    const max = Number.isFinite(Number(body.max)) ? Math.max(1, Math.min(10000, Number(body.max))) : null;
    const job = startCrawl({ seed, sector, mode, refresh, max });
    return sendJson(res, 200, { ok: true, jobId: job.id });
  }

  if (req.method === 'GET' && url.pathname === '/api/crawl') {
    // Recent jobs (newest first), without the full lines blob
    const list = Array.from(crawlJobs.values())
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
      .slice(0, 20)
      .map(j => ({ ...j, lines: undefined, lineCount: j.lines.length }));
    return sendJson(res, 200, { ok: true, jobs: list });
  }

  const mJob = url.pathname.match(/^\/api\/crawl\/([^/]+)$/);
  if (mJob && req.method === 'GET') {
    const job = crawlJobs.get(decodeURIComponent(mJob[1]));
    if (!job) return sendJson(res, 404, { ok: false, error: 'unknown job' });
    return sendJson(res, 200, { ok: true, job });
  }

  // Unregister: remove from data/products.json + flip the source candidate
  // (looked up via product.candidateId) back to discarded.
  const mUnreg = url.pathname.match(/^\/api\/registered\/([^/]+)\/unregister$/);
  if (mUnreg && req.method === 'POST') {
    const productId = decodeURIComponent(mUnreg[1]);
    const product = productsStore.byProductId(productId);
    if (!product) return sendJson(res, 404, { ok: false, error: 'unknown product id in products.json' });
    const candIdToFlip = product.candidateId || (productId.startsWith('cand-') ? productId.slice(5) : null);
    productsStore.remove(productId);
    if (candIdToFlip) productPersistence.patch(candIdToFlip, { status: 'discarded' });
    return sendJson(res, 200, { ok: true, removed: productId });
  }

  send404(res);
});

// On boot, sync makers referenced in data/products.json into maker-directory
// so the live catalog appears next to discovered makers in the review UI.
try {
  const sync = syncFromProducts();
  // eslint-disable-next-line no-console
  console.log(`sync from products.json: +${sync.added} new makers (${sync.skipped} already present)`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('sync from products.json failed:', e.message);
}

// ERGSN-owned brand entries (K-Security / K-Tech / K-Energy / K-Bio) live as
// inline catalog on index.html, not in data/products.json. Hand-seed them so
// the review UI shows the full set of onboarded makers.
try {
  const ergsn = syncErgsnSelf();
  // eslint-disable-next-line no-console
  console.log(`sync ERGSN-self: +${ergsn.added} new entries`);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('sync ERGSN-self failed:', e.message);
}

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Maker review UI: http://${HOST}:${PORT}/`);
  // eslint-disable-next-line no-console
  console.log(`(serving ${persistence.FILE})`);
  // eslint-disable-next-line no-console
  console.log('Ctrl+C to stop.');
});
