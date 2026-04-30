'use strict';

/**
 * Cross-tool admin audit client.
 *
 * Tiny helper that posts one audit row to the centralized D1
 * admin_audit_log table on ergsn-trade-docs. Used by maker review,
 * buyer outreach, and any future Node-side admin surface.
 *
 * Env it reads (loaded from .env via the existing dotenv helper):
 *   ERGSN_TRADE_DOCS_ENDPOINT  (default https://ergsn-trade-docs.ceodon.workers.dev)
 *   ERGSN_TRADE_DOCS_ADMIN_KEY  (the X-Admin-Key the Worker checks)
 *
 * If env is missing, audit() silently no-ops — the local action still
 * succeeds. We never want a missing audit credential to block a real
 * admin operation.
 *
 * Usage:
 *   const audit = require('../lib/admin-audit');
 *   audit.log({
 *     source: 'maker-review',
 *     action: 'maker.verify',
 *     targetKind: 'maker',
 *     targetId: 'cosmedique-co-kr',
 *     payload: { from: 'raw', to: 'verified' },
 *     ok: true
 *   });
 *
 * The call returns a Promise but we encourage fire-and-forget at the
 * call site (audit.log(...).catch(() => {})) — none of the existing
 * UI flows should wait on the audit network round-trip.
 */

const DEFAULT_ENDPOINT = 'https://ergsn-trade-docs.ceodon.workers.dev';

function endpoint() {
  return (process.env.ERGSN_TRADE_DOCS_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/$/, '');
}
function adminKey() {
  return process.env.ERGSN_TRADE_DOCS_ADMIN_KEY || process.env.ERGSN_MAIL_ADMIN_KEY || '';
}

async function log(event) {
  if (!event || !event.action) return { ok: false, error: 'missing action' };
  const key = adminKey();
  if (!key) return { ok: false, error: 'no ADMIN_KEY' };  // silent no-op
  const body = {
    actorEmail: event.actorEmail || '',
    action: event.action,
    targetKind: event.targetKind || '',
    targetId: event.targetId || '',
    payload: event.payload || null,
    ok: event.ok !== false,
    source: event.source || ''
  };
  try {
    const res = await fetch(endpoint() + '/admin/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key, 'Origin': 'https://ergsn.net' },
      body: JSON.stringify(body)
    });
    const txt = await res.text().catch(() => '');
    let j; try { j = JSON.parse(txt); } catch { j = { ok: false, raw: txt.slice(0, 120) }; }
    return { ok: !!j.ok && res.ok, status: res.status, response: j };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { log };
