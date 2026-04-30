#!/usr/bin/env node
'use strict';

/**
 * Buyer review server — local-only HTTP server that serves
 * review-buyers.html and proxies read/write of:
 *   - data/buyer-directory.json
 *   - data/buyer-outbox/<id>.json (drafts)
 *   - data/buyer-send-log.json
 *
 * Mirror of scripts/discover-makers/review-server.js but on the buyer
 * side. Different default port so both can run simultaneously
 * (5174=makers · 5175=buyers).
 *
 * Endpoints:
 *   GET   /                              → review-buyers.html
 *   GET   /api/buyers                    → full directory + draft existence + send log summary
 *   POST  /api/buyers                    → create new buyer (manual add)
 *   POST  /api/buyers/:id                → patch { status, sector, buyerType, notes, rejectedReason }
 *   POST  /api/buyers/:id/compose        → run LLM + write draft to data/buyer-outbox/<id>.json
 *   GET   /api/buyers/:id/draft          → read current draft for review
 *   POST  /api/buyers/:id/draft          → patch draft { subject, htmlBody, textBody, status }
 *   POST  /api/buyers/:id/send           → send approved draft via ergsn-mail (one-shot)
 *   POST  /api/crawl/start               → POST { sector, max } → spawn discover.js
 *   GET   /api/crawl                     → recent jobs
 *   GET   /api/crawl/:id                 → one job (lines + counts)
 *   GET   /api/limits                    → AI + Tavily quota state (mirrors maker tool)
 *
 * Auth: same model as maker review-server — REVIEW_TOKEN env opens LAN/tunnel
 * access, otherwise localhost-only.
 */

require('../discover-makers/lib/dotenv').loadDotEnv();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const persistence = require('./lib/persistence');
const { composeMail } = require('./lib/compose-mail');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DISCOVER_JS = path.join(REPO_ROOT, 'scripts', 'discover-buyers', 'discover.js');
const HTML_PATH = path.resolve(__dirname, 'review-buyers.html');
const FAVICON_PATH = path.resolve(REPO_ROOT, 'favicon.svg');
const OUTBOX_DIR = path.join(REPO_ROOT, 'data', 'buyer-outbox');
const SEND_LOG = path.join(REPO_ROOT, 'data', 'buyer-send-log.json');
const PORT = Number(process.env.BUYER_REVIEW_PORT) || 5175;
const TOKEN = String(process.env.REVIEW_TOKEN || '').trim();
const HOST = process.env.REVIEW_HOST || (TOKEN ? '0.0.0.0' : '127.0.0.1');
const COOKIE_NAME = 'ergsn_review_token';
const ALLOWED_STATUS = new Set(['raw', 'verified', 'rejected', 'queued', 'contacted', 'replied', 'converted', 'unsubscribed']);
const ALLOWED_BUYER_TYPES = new Set(['distributor','importer','system-integrator','fed-procurement','retail-chain','marketplace','end-user','broker','unclear']);
const ALLOWED_SECTORS = new Set(['k-security','k-tech','k-energy','k-bio','k-beauty','k-culture-goods','k-franchise','k-smart-living','k-tourism-assets','multi']);

const ERGSN_MAIL_ENDPOINT = process.env.ERGSN_MAIL_ENDPOINT || 'https://ergsn-mail.ceodon.workers.dev';
const ERGSN_MAIL_ADMIN_KEY = process.env.ERGSN_MAIL_ADMIN_KEY || '';

if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });

// ────── In-memory crawl jobs + AI/Tavily quota tracking (mirrors maker tool) ──────
const crawlJobs = new Map();
let crawlSeq = 0;

const AI_DAILY_BUDGET_NEURONS = 10000;
const NEURONS_PER_TOKEN = 0.30;
const aiUsage = { dayKey: '', calls: 0, tokens: 0 };
const aiState = { exceededAt: 0, reason: '' };
const TAVILY_MONTHLY_BUDGET = 1000;
const tavilyUsage = { monthKey: '', calls: 0 };

function utcDayKey() { return new Date().toISOString().slice(0, 10); }
function utcMonthKey() { return new Date().toISOString().slice(0, 7); }
function rollAi() { const k = utcDayKey(); if (aiUsage.dayKey !== k) { aiUsage.dayKey = k; aiUsage.calls = 0; aiUsage.tokens = 0; } }
function rollTavily() { const k = utcMonthKey(); if (tavilyUsage.monthKey !== k) { tavilyUsage.monthKey = k; tavilyUsage.calls = 0; } }
function noteAi(usage) { rollAi(); aiUsage.calls += 1; if (usage) aiUsage.tokens += (usage.input_tokens || 0) + (usage.output_tokens || 0); }
function noteTavily() { rollTavily(); tavilyUsage.calls += 1; }
function isAiQuotaError(t) { return t && (/you have used up your daily free allocation/i.test(t) || /\b10,?000\s*neurons?\b/i.test(t) || /workers ai 429/i.test(t)); }
function noteAiState(line) { if (isAiQuotaError(line)) { aiState.exceededAt = Date.now(); aiState.reason = 'CF Workers AI daily 10,000 Neurons exhausted'; } }
function aiSnapshot() {
  rollAi();
  const RESET_MS = 24 * 60 * 60 * 1000;
  if (aiState.exceededAt && Date.now() - aiState.exceededAt > RESET_MS) { aiState.exceededAt = 0; aiState.reason = ''; }
  return {
    exceeded: !!aiState.exceededAt,
    reason: aiState.reason,
    resetsAt: aiState.exceededAt ? new Date(aiState.exceededAt + RESET_MS).toISOString() : null,
    callsToday: aiUsage.calls, tokensToday: aiUsage.tokens,
    estimatedNeuronsToday: Math.round(aiUsage.tokens * NEURONS_PER_TOKEN),
    budget: AI_DAILY_BUDGET_NEURONS, dayKey: aiUsage.dayKey
  };
}
function tavilySnapshot() {
  rollTavily();
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1, 1); d.setUTCHours(0, 0, 0, 0);
  return { callsThisMonth: tavilyUsage.calls, budget: TAVILY_MONTHLY_BUDGET, monthKey: tavilyUsage.monthKey, resetsAt: d.toISOString() };
}

function startCrawl({ sector, max }) {
  const id = 'job-' + (++crawlSeq).toString(36) + '-' + Date.now().toString(36);
  const args = [DISCOVER_JS, '--seed=search'];
  if (sector === '__all__') args.push('--all-sectors'); else if (sector) args.push(`--sector=${sector}`);
  if (max) args.push(`--max=${max}`);
  const job = { id, sector, max: max || null, status: 'running', startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, error: null, lines: [], counts: { fetched: 0, verified: 0, failed: 0, added: 0, updated: 0 } };
  crawlJobs.set(id, job);
  const child = spawn(process.execPath, args, { cwd: REPO_ROOT });
  job.pid = child.pid;
  const onData = (buf) => {
    const lines = buf.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      job.lines.push(line); if (job.lines.length > 1000) job.lines.splice(0, job.lines.length - 1000);
      noteAiState(line);
      let m;
      if ((m = line.match(/persisted:\s*\+?(\d+)\s*new,\s*(\d+)\s*updated/i))) { job.counts.added = parseInt(m[1], 10); job.counts.updated = parseInt(m[2], 10); }
      if ((m = line.match(/summary:\s*(\d+)\s*fetched\s*·\s*(\d+)\s*verified.*?(\d+)\s*failed/i))) { job.counts.fetched = parseInt(m[1], 10); job.counts.verified = parseInt(m[2], 10); job.counts.failed = parseInt(m[3], 10); }
      if ((m = line.match(/^\s*\[\s*(\d+)\s*\/\s*(\d+)\s*\]\s+(VERIFIED|RAW|FAIL)/i))) {
        const idx = parseInt(m[1], 10), tag = m[3].toUpperCase();
        if (tag === 'FAIL') job.counts.failed = (job.counts.failed || 0) + 1;
        else { job.counts.fetched = idx - (job.counts.failed || 0); if (tag === 'VERIFIED') job.counts.verified = (job.counts.verified || 0) + 1; }
      }
      if ((m = line.match(/^ai-call:\s*in=(\d+)\s+out=(\d+)/i))) noteAi({ input_tokens: parseInt(m[1], 10), output_tokens: parseInt(m[2], 10) });
      if ((m = line.match(/^tavily-call:\s*status=(\d+)/i))) noteTavily();
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', b => onData(Buffer.from(b.toString().split(/\r?\n/).map(l => l ? '! ' + l : l).join('\n'))));
  child.on('error', err => { job.error = err.message; job.status = 'error'; job.finishedAt = new Date().toISOString(); });
  child.on('exit', code => { job.exitCode = code; job.status = code === 0 ? 'done' : 'error'; job.finishedAt = new Date().toISOString(); });
  return job;
}

// ────── HTTP helpers ──────
function sendJson(res, status, obj) { const body = JSON.stringify(obj); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }); res.end(body); }
function send404(res) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); }
function isLocalhost(r) { return r === '127.0.0.1' || r === '::1' || r === '::ffff:127.0.0.1'; }
function readCookie(req, name) { const raw = req.headers.cookie || ''; const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
function parseBody(req) { return new Promise((resolve, reject) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1024 * 64) { reject(new Error('body too large')); req.destroy(); } }); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }

function readDraft(id) {
  const p = path.join(OUTBOX_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeDraft(id, draft) {
  const p = path.join(OUTBOX_DIR, `${id}.json`);
  fs.writeFileSync(p, JSON.stringify(draft, null, 2) + '\n');
}
function readSendLog() {
  if (!fs.existsSync(SEND_LOG)) return { sends: [] };
  try { const o = JSON.parse(fs.readFileSync(SEND_LOG, 'utf8')); if (!Array.isArray(o.sends)) o.sends = []; return o; } catch { return { sends: [] }; }
}
function appendSendLog(entry) { const o = readSendLog(); o.sends.push(entry); fs.writeFileSync(SEND_LOG, JSON.stringify(o, null, 2) + '\n'); }

// ────── Server ──────
const server = http.createServer(async (req, res) => {
  const remote = req.socket.remoteAddress;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Auth gate
  if (!TOKEN) {
    if (!isLocalhost(remote)) { res.writeHead(403); res.end('forbidden'); return; }
  } else {
    const queryT = url.searchParams.get('t') || '';
    const cookieT = readCookie(req, COOKIE_NAME);
    const provided = queryT || cookieT;
    if (provided !== TOKEN) { res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Unauthorized — append ?t=<token>.'); return; }
    if (queryT && req.method === 'GET' && !cookieT) {
      url.searchParams.delete('t');
      res.writeHead(302, { 'Location': url.pathname + (url.search || ''), 'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(TOKEN)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
      res.end();
      return;
    }
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/review-buyers.html')) {
    fs.readFile(HTML_PATH, (err, buf) => { if (err) { send404(res); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(buf); });
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/favicon.svg' || url.pathname === '/favicon.ico')) {
    fs.readFile(FAVICON_PATH, (err, buf) => { if (err) { send404(res); return; } res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' }); res.end(buf); });
    return;
  }

  // Buyers list (with draft existence + send log summary)
  if (req.method === 'GET' && url.pathname === '/api/buyers') {
    const obj = persistence.read();
    const log = readSendLog();
    const sentByBuyer = new Map();
    for (const s of (log.sends || [])) {
      if (!sentByBuyer.has(s.buyerId)) sentByBuyer.set(s.buyerId, []);
      sentByBuyer.get(s.buyerId).push(s);
    }
    for (const b of obj.buyers) {
      const draft = readDraft(b.id);
      b._hasDraft = !!draft;
      b._draftStatus = draft ? draft.status : null;
      b._sends = (sentByBuyer.get(b.id) || []).map(s => ({ sentAt: s.sentAt, ok: s.ok, subject: s.subject }));
    }
    return sendJson(res, 200, obj);
  }

  // Add buyer
  if (req.method === 'POST' && url.pathname === '/api/buyers') {
    let body; try { body = await parseBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const legalName = String(body.legalName || '').trim().slice(0, 200);
    if (!legalName) return sendJson(res, 400, { ok: false, error: 'legalName required' });
    const sector = String(body.sector || 'multi'); if (!ALLOWED_SECTORS.has(sector)) return sendJson(res, 400, { ok: false, error: 'bad sector' });
    const status = String(body.status || 'raw'); if (!ALLOWED_STATUS.has(status)) return sendJson(res, 400, { ok: false, error: 'bad status' });
    const homepage = String(body.homepageUrl || '').trim();
    let host = ''; try { if (homepage) host = new URL(homepage).host.toLowerCase().replace(/^www\./, ''); } catch (_) {}
    const slug = (legalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'buyer').slice(0, 60);
    let id = host ? host.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : slug;
    const obj = persistence.read();
    let n = 1;
    while (obj.buyers.find(b => b.id === id)) id = (host ? host.replace(/[^a-z0-9]+/g, '-') : slug) + '-' + (++n);
    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      id, legalName, displayName: body.displayName || legalName,
      country: String(body.country || '').toUpperCase().slice(0, 2),
      region: String(body.region || ''), sector,
      buyerType: ALLOWED_BUYER_TYPES.has(body.buyerType) ? body.buyerType : 'unclear',
      homepageUrl: homepage, homepageHost: host,
      headquartersAddress: '', primaryProductInterest: [], knownTradeHistoryWithKorea: false,
      contact: {
        primaryEmail: String(body.primaryEmail || ''), procurementEmail: String(body.procurementEmail || ''),
        decisionMaker: String(body.decisionMaker || ''), decisionMakerTitle: String(body.decisionMakerTitle || ''),
        tel: String(body.tel || ''), linkedinUrl: String(body.linkedinUrl || '')
      },
      sources: [{ seed: 'manual:add-ui', seedQuery: '', discoveredAt: today }],
      status, discoveredAt: today, lastVerifiedAt: new Date().toISOString(), notes: String(body.notes || '').slice(0, 1000)
    };
    obj.buyers.push(entry); persistence.write(obj);
    return sendJson(res, 200, { ok: true, entry });
  }

  // Patch buyer
  const mPatch = url.pathname.match(/^\/api\/buyers\/([^/]+)$/);
  if (mPatch && req.method === 'POST') {
    const id = decodeURIComponent(mPatch[1]);
    let body; try { body = await parseBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const obj = persistence.read();
    const entry = obj.buyers.find(b => b.id === id);
    if (!entry) return sendJson(res, 404, { ok: false, error: 'unknown buyer' });
    if (typeof body.status === 'string') { if (!ALLOWED_STATUS.has(body.status)) return sendJson(res, 400, { ok: false, error: 'bad status' }); entry.status = body.status; }
    if (typeof body.sector === 'string') { if (!ALLOWED_SECTORS.has(body.sector)) return sendJson(res, 400, { ok: false, error: 'bad sector' }); entry.sector = body.sector; }
    if (typeof body.buyerType === 'string') { if (!ALLOWED_BUYER_TYPES.has(body.buyerType)) return sendJson(res, 400, { ok: false, error: 'bad buyerType' }); entry.buyerType = body.buyerType; }
    if (typeof body.notes === 'string') entry.notes = body.notes.slice(0, 2000);
    if (typeof body.rejectedReason === 'string') entry.rejectedReason = body.rejectedReason.slice(0, 200);
    if (body.contact && typeof body.contact === 'object') {
      entry.contact = entry.contact || {};
      for (const k of ['primaryEmail','procurementEmail','decisionMaker','decisionMakerTitle','tel','linkedinUrl']) {
        if (typeof body.contact[k] === 'string') entry.contact[k] = body.contact[k].slice(0, 200);
      }
    }
    entry.lastVerifiedAt = new Date().toISOString();
    persistence.write(obj);
    return sendJson(res, 200, { ok: true, entry });
  }

  // Compose draft
  const mCompose = url.pathname.match(/^\/api\/buyers\/([^/]+)\/compose$/);
  if (mCompose && req.method === 'POST') {
    const id = decodeURIComponent(mCompose[1]);
    const obj = persistence.read();
    const buyer = obj.buyers.find(b => b.id === id);
    if (!buyer) return sendJson(res, 404, { ok: false, error: 'unknown buyer' });
    try {
      const draft = await composeMail(buyer);
      writeDraft(id, draft);
      if (draft.usage) noteAi(draft.usage);
      return sendJson(res, 200, { ok: true, draft });
    } catch (e) {
      noteAiState(e.message || '');
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // Read / patch draft
  const mDraft = url.pathname.match(/^\/api\/buyers\/([^/]+)\/draft$/);
  if (mDraft && req.method === 'GET') {
    const id = decodeURIComponent(mDraft[1]);
    const draft = readDraft(id);
    if (!draft) return sendJson(res, 404, { ok: false, error: 'no draft' });
    return sendJson(res, 200, { ok: true, draft });
  }
  if (mDraft && req.method === 'POST') {
    const id = decodeURIComponent(mDraft[1]);
    let body; try { body = await parseBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const draft = readDraft(id);
    if (!draft) return sendJson(res, 404, { ok: false, error: 'no draft — compose first' });
    if (typeof body.subject === 'string') draft.subject = body.subject.slice(0, 200);
    if (typeof body.htmlBody === 'string') draft.htmlBody = body.htmlBody;
    if (typeof body.textBody === 'string') draft.textBody = body.textBody;
    if (typeof body.toEmail === 'string')  draft.toEmail = body.toEmail.slice(0, 200);
    if (typeof body.status === 'string' && ['draft','approved','sent','failed','rejected'].includes(body.status)) draft.status = body.status;
    writeDraft(id, draft);
    return sendJson(res, 200, { ok: true, draft });
  }

  // Send draft (one-shot, mirrors send.js but for the UI Send button)
  const mSend = url.pathname.match(/^\/api\/buyers\/([^/]+)\/send$/);
  if (mSend && req.method === 'POST') {
    const id = decodeURIComponent(mSend[1]);
    const obj = persistence.read();
    const buyer = obj.buyers.find(b => b.id === id);
    if (!buyer) return sendJson(res, 404, { ok: false, error: 'unknown buyer' });
    if (buyer.status === 'rejected' || buyer.status === 'unsubscribed') return sendJson(res, 400, { ok: false, error: `buyer status=${buyer.status}` });
    const draft = readDraft(id);
    if (!draft) return sendJson(res, 404, { ok: false, error: 'no draft — compose first' });
    if (draft.status !== 'approved') return sendJson(res, 400, { ok: false, error: 'draft must be status=approved before send' });
    if (!draft.toEmail) return sendJson(res, 400, { ok: false, error: 'no toEmail' });
    if (!ERGSN_MAIL_ADMIN_KEY) return sendJson(res, 500, { ok: false, error: 'ERGSN_MAIL_ADMIN_KEY not configured in .env' });
    try {
      const resp = await fetch(ERGSN_MAIL_ENDPOINT + '/admin-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ERGSN_MAIL_ADMIN_KEY, 'Origin': 'https://ergsn.net' },
        body: JSON.stringify({
          // Worker expects an array (or bare string) — single object triggers
          // "invalid `to` address" via the [{email: <whole obj>}] mis-wrap.
          to: [{ email: draft.toEmail, ...(draft.toName ? { name: draft.toName } : {}) }],
          from: draft.fromEmail, fromName: draft.fromName, replyTo: draft.replyTo || draft.fromEmail,
          subject: draft.subject, htmlBody: draft.htmlBody, textBody: draft.textBody || '', locale: 'en'
        })
      });
      const txt = await resp.text();
      let j; try { j = JSON.parse(txt); } catch { j = { ok: false, raw: txt.slice(0, 200) }; }
      const sentAt = new Date().toISOString();
      appendSendLog({ buyerId: id, toEmail: draft.toEmail, subject: draft.subject, sentAt, ok: !!j.ok, httpStatus: resp.status, composedBy: draft.composedBy, response: j });
      if (j.ok) {
        buyer.status = 'contacted'; buyer.lastEmailedAt = sentAt; persistence.write(obj);
        draft.status = 'sent'; draft.sentAt = sentAt; writeDraft(id, draft);
        return sendJson(res, 200, { ok: true, sentAt, response: j });
      }
      draft.status = 'failed'; draft.lastError = JSON.stringify(j).slice(0, 200); writeDraft(id, draft);
      return sendJson(res, 502, { ok: false, error: 'mail-worker rejected', httpStatus: resp.status, response: j });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // Crawl
  if (req.method === 'POST' && url.pathname === '/api/crawl/start') {
    let body; try { body = await parseBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'bad json' }); }
    const sector = String(body.sector || '__all__');
    const max = Number.isFinite(Number(body.max)) ? Math.max(1, Math.min(10000, Number(body.max))) : null;
    const job = startCrawl({ sector, max });
    return sendJson(res, 200, { ok: true, jobId: job.id });
  }
  if (req.method === 'GET' && url.pathname === '/api/crawl') {
    const list = Array.from(crawlJobs.values()).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')).slice(0, 20).map(j => ({ ...j, lines: undefined, lineCount: j.lines.length }));
    return sendJson(res, 200, { ok: true, jobs: list });
  }
  const mJob = url.pathname.match(/^\/api\/crawl\/([^/]+)$/);
  if (mJob && req.method === 'GET') {
    const job = crawlJobs.get(decodeURIComponent(mJob[1]));
    if (!job) return sendJson(res, 404, { ok: false, error: 'unknown job' });
    return sendJson(res, 200, { ok: true, job });
  }

  // Limits
  if (req.method === 'GET' && url.pathname === '/api/limits') {
    return sendJson(res, 200, { ok: true, ai: aiSnapshot(), tavily: tavilySnapshot() });
  }

  send404(res);
});

server.listen(PORT, HOST, () => {
  /* eslint-disable no-console */
  if (TOKEN) {
    console.log(`Buyer review UI (token-protected, listening on ${HOST}:${PORT}):`);
    console.log(`  Local:     http://127.0.0.1:${PORT}/?t=${TOKEN}`);
    try {
      const nets = require('os').networkInterfaces();
      for (const name of Object.keys(nets)) for (const ni of (nets[name] || [])) if (ni.family === 'IPv4' && !ni.internal) console.log(`  LAN:       http://${ni.address}:${PORT}/?t=${TOKEN}`);
    } catch (_) {}
  } else {
    console.log(`Buyer review UI: http://${HOST}:${PORT}/`);
    console.log('  (localhost-only — set REVIEW_TOKEN to enable LAN/tunnel)');
  }
  console.log(`(serving ${persistence.FILE})`);
  console.log('Ctrl+C to stop.');
  /* eslint-enable no-console */
});
