#!/usr/bin/env node
'use strict';

/**
 * send.js — sends approved drafts to buyers via the ergsn-mail Worker.
 *
 * Approval gate: the script ONLY sends drafts whose JSON has
 * `"status": "approved"`. The compose step writes drafts at status
 * "draft" — a human must flip to "approved" (manual edit OR
 * review-server.js → Approve button) before send.js will send it.
 *
 * Refusal rules (defense-in-depth):
 *   - Buyer status must NOT be "rejected", "unsubscribed".
 *   - Sending duplicates within 7 days is blocked unless --force.
 *   - --dry-run prints what WOULD be sent without hitting the Worker.
 *   - Without --confirm, the script prints the plan but does not send.
 *
 * Usage:
 *   node scripts/discover-buyers/send.js                        (dry-run preview)
 *   node scripts/discover-buyers/send.js --confirm              (actually send all approved)
 *   node scripts/discover-buyers/send.js --buyer=shredder-warehouse-com --confirm
 *   node scripts/discover-buyers/send.js --max=5 --confirm
 *
 * Required env (in .env):
 *   ERGSN_MAIL_ADMIN_KEY    — same value as the ergsn-mail Worker secret ADMIN_KEY
 *   ERGSN_MAIL_ENDPOINT     — defaults to https://ergsn-mail.ceodon.workers.dev
 */

require('../discover-makers/lib/dotenv').loadDotEnv();

const fs = require('fs');
const path = require('path');
const persistence = require('./lib/persistence');

const OUTBOX_DIR = path.resolve(__dirname, '..', '..', 'data', 'buyer-outbox');
const SEND_LOG   = path.resolve(__dirname, '..', '..', 'data', 'buyer-send-log.json');
const DEFAULT_ENDPOINT = 'https://ergsn-mail.ceodon.workers.dev';
const DUP_WINDOW_DAYS = 7;

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function readSendLog() {
  if (!fs.existsSync(SEND_LOG)) return { _doc: 'ERGSN buyer send log — append-only record of every cold-mail attempt.', sends: [] };
  const obj = JSON.parse(fs.readFileSync(SEND_LOG, 'utf8'));
  if (!Array.isArray(obj.sends)) obj.sends = [];
  return obj;
}
function appendSendLog(entry) {
  const obj = readSendLog();
  obj.sends.push(entry);
  fs.writeFileSync(SEND_LOG, JSON.stringify(obj, null, 2) + '\n');
}

function loadDrafts({ buyer }) {
  if (!fs.existsSync(OUTBOX_DIR)) return [];
  const files = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith('.json'));
  const drafts = [];
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    if (buyer && buyer !== id) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(OUTBOX_DIR, f), 'utf8'));
      d._file = path.join(OUTBOX_DIR, f);
      d._buyerId = id;
      drafts.push(d);
    } catch (e) {
      console.error(`  skip ${f} — bad JSON: ${e.message}`);
    }
  }
  return drafts;
}

function recentlySent(buyerId, log) {
  const cutoff = Date.now() - DUP_WINDOW_DAYS * 86400 * 1000;
  return (log.sends || []).some(s => s.buyerId === buyerId && Date.parse(s.sentAt) >= cutoff);
}

async function sendOne(draft, endpoint, adminKey) {
  // Worker's normaliseRecipients expects either a string or an array of
  // {email,name} objects, NOT a single object — passing a bare object
  // triggers "invalid `to` address" (the wrap [{email: <whole obj>}]
  // misreads our object-as-email).
  const body = {
    to: [{ email: draft.toEmail, ...(draft.toName ? { name: draft.toName } : {}) }],
    from: draft.fromEmail,
    fromName: draft.fromName,
    replyTo: draft.replyTo || draft.fromEmail,
    subject: draft.subject,
    htmlBody: draft.htmlBody,
    textBody: draft.textBody || '',
    locale: 'en'
  };
  const res = await fetch(endpoint + '/admin-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey, 'Origin': 'https://ergsn.net' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { ok: false, raw: text.slice(0, 200) }; }
  return { httpStatus: res.status, ok: !!j.ok, body: j };
}

async function main() {
  const args = parseArgs(process.argv);
  const endpoint = process.env.ERGSN_MAIL_ENDPOINT || DEFAULT_ENDPOINT;
  const adminKey = process.env.ERGSN_MAIL_ADMIN_KEY || '';
  const dryRun = !args.confirm;

  if (!dryRun && !adminKey) {
    console.error('error: ERGSN_MAIL_ADMIN_KEY missing in .env (required for --confirm sends)');
    process.exit(1);
  }

  const buyers = persistence.read().buyers;
  const buyerById = new Map(buyers.map(b => [b.id, b]));
  const drafts = loadDrafts({ buyer: args.buyer });
  const log = readSendLog();

  // Filter to approved + not rejected/unsubscribed + not recently sent
  const queue = [];
  const skipped = [];
  for (const d of drafts) {
    const b = buyerById.get(d._buyerId);
    if (!b) { skipped.push({ id: d._buyerId, why: 'buyer not in directory' }); continue; }
    if (b.status === 'rejected' || b.status === 'unsubscribed') { skipped.push({ id: b.id, why: `buyer status=${b.status}` }); continue; }
    if (d.status !== 'approved') { skipped.push({ id: b.id, why: `draft status=${d.status} (need 'approved')` }); continue; }
    if (!d.toEmail) { skipped.push({ id: b.id, why: 'no toEmail in draft' }); continue; }
    if (!args.force && recentlySent(b.id, log)) { skipped.push({ id: b.id, why: `sent within ${DUP_WINDOW_DAYS}d (use --force to override)` }); continue; }
    queue.push({ buyer: b, draft: d });
    if (args.max && queue.length >= Number(args.max)) break;
  }

  console.log(`send: ${queue.length} approved draft(s) ready · ${skipped.length} skipped${dryRun ? ' · DRY-RUN (use --confirm to send)' : ''}`);
  for (const s of skipped) console.log(`  skip ${s.id} — ${s.why}`);
  for (const { buyer, draft } of queue) {
    console.log(`  ${dryRun ? 'PLAN' : 'SEND'}  ${buyer.id}  →  ${draft.toEmail}  ·  "${draft.subject}"`);
  }
  if (dryRun) {
    console.log('\nadd --confirm to actually send.');
    return;
  }

  // Real send loop with polite gap
  let sent = 0, failed = 0;
  for (const { buyer, draft } of queue) {
    let result;
    try { result = await sendOne(draft, endpoint, adminKey); }
    catch (e) {
      result = { httpStatus: 0, ok: false, body: { error: e.message } };
    }
    const sentAt = new Date().toISOString();
    appendSendLog({
      buyerId: buyer.id,
      toEmail: draft.toEmail,
      subject: draft.subject,
      sentAt,
      ok: result.ok,
      httpStatus: result.httpStatus,
      composedBy: draft.composedBy,
      response: result.body
    });
    // Update buyer status + draft status
    if (result.ok) {
      const obj = persistence.read();
      const x = obj.buyers.find(z => z.id === buyer.id);
      if (x) { x.status = 'contacted'; x.lastEmailedAt = sentAt; persistence.write(obj); }
      draft.status = 'sent';
      draft.sentAt = sentAt;
      fs.writeFileSync(draft._file, JSON.stringify(draft, null, 2) + '\n');
      sent += 1;
      console.log(`  OK   ${buyer.id}  ·  HTTP ${result.httpStatus}`);
    } else {
      draft.status = 'failed';
      draft.lastError = JSON.stringify(result.body).slice(0, 200);
      fs.writeFileSync(draft._file, JSON.stringify(draft, null, 2) + '\n');
      failed += 1;
      console.log(`  FAIL ${buyer.id}  ·  HTTP ${result.httpStatus}  ·  ${draft.lastError}`);
    }
    // Polite 2s gap so Resend doesn't rate-limit + reputation stays clean
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\nsend complete: ${sent} sent · ${failed} failed`);
}

main().catch(err => { console.error(`error: ${err.message || err}`); process.exit(1); });
