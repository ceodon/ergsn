/**
 * ERGSN Trade Documentation Worker
 *
 * D1-backed REST API behind the trade-docs admin tool + buyer portal.
 * Serves the full 5-doc workflow:
 *   Quotation → P/O → Proforma Invoice → Commercial Invoice → Packing List
 * All linked by a parent transaction_id.
 *
 * ────────────────────────────────────────────────────────────────────────
 * AUTH
 *
 *   Admin endpoints require X-Admin-Key header (matches ADMIN_KEY secret).
 *   Buyer endpoints require ?t=<32-char-token> in the query string and
 *   only return data for that buyer's own transaction.
 *
 * ENDPOINTS
 *
 *   --- transactions ---
 *   POST  /tx                              admin · create new transaction
 *   GET   /tx                              admin · list (status filter)
 *   GET   /tx/:id                          admin · single
 *   PATCH /tx/:id                          admin · update status/notes
 *
 *   --- per-doc (replace :type with quotation|po|proforma|commercial|packing) ---
 *   POST  /doc/:type                       admin · create
 *   GET   /doc/:type/:id                   admin · single
 *   PATCH /doc/:type/:id                   admin · update
 *   GET   /doc/by-tx/:txId                 admin · all docs for a transaction
 *
 *   --- buyer portal ---
 *   GET   /buyer?t=<token>                 public (token-gated) · buyer's
 *                                           transaction + all related docs
 *
 *   --- meta ---
 *   GET   /health                          public · {ok:true, version}
 *
 * ────────────────────────────────────────────────────────────────────────
 * CORS
 *
 *   Same comma-list ALLOW_ORIGIN as the other Workers. Buyer endpoint also
 *   accepts the legacy GH Pages origin during transition.
 */

const VERSION = 'trade-docs-2026-04-26-v3-phase8';

/* Default seller block — shown on every doc. The owner can override via
   /system-settings without redeploying. Keep in sync with footer.js
   address line. */
const SELLER_DEFAULT = {
  name: 'ERGSN CO., LTD.',
  address: '#503 Susong BD, 12-21, Seoae-ro 5-gil, Joong-gu, Seoul 04623, Republic of Korea',
  phone: '+82-10-5288-0006',
  email: 'ceodon@gmail.com',
  website: 'ergsn.net'
};

const DOC_TABLES = {
  quotation:  { table: 'quotations',          prefix: 'Q'  },
  po:         { table: 'purchase_orders',     prefix: 'PO' },
  proforma:   { table: 'proforma_invoices',   prefix: 'PI' },
  commercial: { table: 'commercial_invoices', prefix: 'CI' },
  packing:    { table: 'packing_lists',       prefix: 'PL' }
};

/* State machine — must mirror scripts/trade-docs.js STATUS_NEXT.
   `cancelled` is allowed from any non-terminal state. */
const STATUS_NEXT = {
  open:                ['quoted', 'cancelled'],
  quoted:              ['po-received', 'cancelled'],
  'po-received':       ['proforma-sent', 'cancelled'],
  'proforma-sent':     ['paid', 'cancelled'],
  paid:                ['commercial-issued', 'cancelled'],
  'commercial-issued': ['packing-issued', 'cancelled'],
  'packing-issued':    ['shipped', 'cancelled'],
  shipped:             ['closed', 'cancelled'],
  closed:              [],
  cancelled:           []
};

const STATUS_LABELS = {
  open: 'Open', quoted: 'Quoted', 'po-received': 'P/O received',
  'proforma-sent': 'Proforma sent', paid: 'Paid',
  'commercial-issued': 'Commercial issued', 'packing-issued': 'Packing issued',
  shipped: 'Shipped', closed: 'Closed', cancelled: 'Cancelled'
};

/* Reverse map — used by `revert: true` PATCH to allow exactly one step
   backward in case admin advanced too far (e.g. Mark Paid by mistake). */
const STATUS_PREV = {
  quoted:              'open',
  'po-received':       'quoted',
  'proforma-sent':     'po-received',
  paid:                'proforma-sent',
  'commercial-issued': 'paid',
  'packing-issued':    'commercial-issued',
  shipped:             'packing-issued',
  closed:              'shipped'
};

/* Public endpoints that get rate-limited (admin endpoints rely on key). */
const PUBLIC_RATE_LIMITED = ['/rfq-bridge', '/buyer/po', '/buyer/accept-quotation', '/buyer/reject-quotation', '/upload'];
/* Sliding-window: max N requests per IP per minute per path. Conservative
   defaults — bona-fide buyers won't hit this; bots will. */
const RATE_LIMIT_PER_MIN = 30;

export default {
  /* Cron trigger entry point — Cloudflare invokes this on the schedule
     declared in wrangler.trade-docs.jsonc. We use it for buyer reminders
     (quote-expiring, unpaid-proforma). See handleScheduled below. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env, event));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    /* Lightweight rate limiting on the public surface. Skip for admin
       endpoints (X-Admin-Key gate is stronger). */
    if (PUBLIC_RATE_LIMITED.some(p => path === p || path.startsWith(p + '/'))) {
      const limited = await rateLimit(request, env, path);
      if (limited) return fail(429, 'rate limited', cors);
    }

    try {
      /* meta */
      if (path === '/health') return ok({ ok: true, version: VERSION }, cors);

      /* buyer (token-gated) */
      if (path === '/buyer' && request.method === 'GET') {
        return handleBuyerView(url, env, cors);
      }
      if (path === '/buyer/po' && request.method === 'POST') {
        return handleBuyerPO(request, env, cors);
      }
      if (path === '/buyer/accept-quotation' && request.method === 'POST') {
        return handleBuyerAcceptQuotation(request, env, cors);
      }

      /* public RFQ bridge — origin-gated, no admin key required.
         Called by index.html#rfq submitRFQ() after the rfq-tracker create. */
      if (path === '/rfq-bridge' && request.method === 'POST') {
        return handleRfqBridge(request, env, cors);
      }

      /* admin: transactions */
      if (path === '/tx' && request.method === 'POST')   return adminGate(request, env, cors, () => createTransaction(request, env, cors));
      if (path === '/tx' && request.method === 'GET')    return adminGate(request, env, cors, () => listTransactions(url, env, cors));
      const txMatch = path.match(/^\/tx\/([\w-]+)$/);
      if (txMatch && request.method === 'GET')   return adminGate(request, env, cors, () => getTransaction(txMatch[1], env, cors));
      if (txMatch && request.method === 'PATCH') return adminGate(request, env, cors, () => patchTransaction(txMatch[1], request, env, cors));

      /* admin: per-doc */
      const docCreate = path.match(/^\/doc\/(\w+)$/);
      if (docCreate && request.method === 'POST') return adminGate(request, env, cors, () => createDoc(docCreate[1], request, env, cors));

      const docOne = path.match(/^\/doc\/(\w+)\/([\w-]+)$/);
      if (docOne && request.method === 'GET')   return adminGate(request, env, cors, () => getDoc(docOne[1], docOne[2], env, cors));
      if (docOne && request.method === 'PATCH') return adminGate(request, env, cors, () => patchDoc(docOne[1], docOne[2], request, env, cors));

      const docByTx = path.match(/^\/doc\/by-tx\/([\w-]+)$/);
      if (docByTx && request.method === 'GET') return adminGate(request, env, cors, () => listDocsByTx(docByTx[1], env, cors));

      /* Phase D — admin: 1-click doc succession (e.g. Quotation → Proforma) */
      const docFrom = path.match(/^\/doc\/from\/(\w+)\/([\w-]+)\/to\/(\w+)$/);
      if (docFrom && request.method === 'POST') {
        return adminGate(request, env, cors, () => createDocFromAnother(docFrom[1], docFrom[2], docFrom[3], request, env, cors));
      }

      /* admin: audit log */
      const auditByTx = path.match(/^\/audit\/by-tx\/([\w-]+)$/);
      if (auditByTx && request.method === 'GET') return adminGate(request, env, cors, () => listAuditByTx(auditByTx[1], env, cors));
      if (path === '/audit/recent' && request.method === 'GET') return adminGate(request, env, cors, () => listAuditRecent(url, env, cors));

      /* admin: email log */
      const emailByTx = path.match(/^\/email-log\/by-tx\/([\w-]+)$/);
      if (emailByTx && request.method === 'GET') return adminGate(request, env, cors, () => listEmailByTx(emailByTx[1], env, cors));

      /* admin: send doc to buyer (server-side, so we can log + record + retry) */
      const sendDoc = path.match(/^\/send\/(\w+)\/([\w-]+)$/);
      if (sendDoc && request.method === 'POST') return adminGate(request, env, cors, () => sendDocToBuyer(sendDoc[1], sendDoc[2], request, env, cors));

      /* admin: AI draft (Phase E) — drafts quotation line items from RFQ summary */
      if (path === '/ai/draft-quotation' && request.method === 'POST') {
        return adminGate(request, env, cors, () => aiDraftQuotation(request, env, cors));
      }

      /* admin: CSV export */
      if (path === '/export/transactions.csv' && request.method === 'GET') {
        return adminGate(request, env, cors, () => exportTransactionsCsv(url, env, cors));
      }

      /* attachments — buyer-accessible (token-gated) for view & their own
         payment-proof upload; admin-accessible for all kinds */
      if (path === '/upload' && request.method === 'POST') {
        return handleUpload(request, env, cors);                  // auth resolves inside (admin OR buyer token)
      }
      const fileMatch = path.match(/^\/file\/(AT-\d{4}-\d{4})$/);
      if (fileMatch && request.method === 'GET') {
        return handleFileGet(fileMatch[1], url, env, cors);       // ?t=token (buyer) or X-Admin-Key (admin)
      }
      const attTx = path.match(/^\/attachments\/by-tx\/([\w-]+)$/);
      if (attTx && request.method === 'GET') {
        return handleAttachmentList(attTx[1], url, env, cors);
      }
      const attDel = path.match(/^\/attachment\/(AT-\d{4}-\d{4})$/);
      if (attDel && request.method === 'DELETE') {
        return adminGate(request, env, cors, () => deleteAttachment(attDel[1], env, cors));
      }

      /* Phase 8-A — public seal asset. Render in invoice headers. No token
         required because the seal is intentionally a published trust mark. */
      if (path === '/system/seal' && request.method === 'GET') {
        return serveSeal(env, cors);
      }

      /* Phase 8-A — system settings (seller info, seal R2 key, reminder
         thresholds). Single object PATCH/GET. */
      if (path === '/system-settings' && request.method === 'GET') {
        return adminGate(request, env, cors, () => getSettings(env, cors));
      }
      if (path === '/system-settings' && request.method === 'PATCH') {
        return adminGate(request, env, cors, () => patchSettings(request, env, cors));
      }

      /* Phase 8-A — buyer token rotate (revokes old URL, mints new) */
      const txRotate = path.match(/^\/tx\/([\w-]+)\/rotate-token$/);
      if (txRotate && request.method === 'POST') {
        return adminGate(request, env, cors, () => rotateBuyerToken(txRotate[1], env, cors));
      }

      /* Phase 8-A — doc revision (POST creates a new revision row, marks
         the old as superseded; the buyer keeps seeing the latest only) */
      const docRevise = path.match(/^\/doc\/(\w+)\/([\w-]+)\/revise$/);
      if (docRevise && request.method === 'POST') {
        return adminGate(request, env, cors, () => reviseDoc(docRevise[1], docRevise[2], request, env, cors));
      }

      /* Phase 8-B — webhooks CRUD */
      if (path === '/webhooks' && request.method === 'GET') {
        return adminGate(request, env, cors, () => listWebhooks(env, cors));
      }
      if (path === '/webhooks' && request.method === 'POST') {
        return adminGate(request, env, cors, () => createWebhook(request, env, cors));
      }
      const webhookOne = path.match(/^\/webhooks\/(\d+)$/);
      if (webhookOne && request.method === 'DELETE') {
        return adminGate(request, env, cors, () => deleteWebhook(webhookOne[1], env, cors));
      }

      /* Phase 8-B — manual cron trigger (for testing, also mounted on cron) */
      if (path === '/cron/run' && request.method === 'POST') {
        return adminGate(request, env, cors, async () => {
          const r = await handleScheduled(env, { scheduledTime: Date.now() });
          return ok({ ok: true, ran: r }, cors);
        });
      }

      /* Phase 8-B — stats dashboard */
      if (path === '/stats' && request.method === 'GET') {
        return adminGate(request, env, cors, () => getStats(url, env, cors));
      }

      /* Phase 8-B — CSV import (transactions seed) */
      if (path === '/import/transactions.csv' && request.method === 'POST') {
        return adminGate(request, env, cors, () => importTransactionsCsv(request, env, cors));
      }

      /* Phase 8-B — buyer reject / counter-offer (token-gated) */
      if (path === '/buyer/reject-quotation' && request.method === 'POST') {
        return handleBuyerRejectQuotation(request, env, cors);
      }

      return fail(404, 'not found', cors);
    } catch (e) {
      return fail(500, String(e && e.message || e).slice(0, 300), cors);
    }
  }
};

/* ───────────── auth + cors helpers ───────────── */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allow = (env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
  const matched = allow.includes('*') ? '*' : (allow.includes(origin) ? origin : '');
  return {
    'Access-Control-Allow-Origin':  matched,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age':       '86400',
    'Vary': 'Origin'
  };
}

function adminGate(request, env, cors, next) {
  const key = request.headers.get('X-Admin-Key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return fail(401, 'unauthorized', cors);
  return next();
}

function ok(obj, cors)            { return new Response(JSON.stringify(obj),                     { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }); }
function fail(status, error, cors){ return new Response(JSON.stringify({ ok: false, error }),    { status,      headers: { ...cors, 'Content-Type': 'application/json' } }); }

/* ───────────── id sequence ───────────── */

async function nextId(env, prefix) {
  const year = new Date().getUTCFullYear();
  /* Atomic upsert + read in one batch */
  await env.DB.prepare(
    `INSERT INTO id_sequences (prefix, year, next_seq) VALUES (?, ?, 1)
     ON CONFLICT(prefix, year) DO UPDATE SET next_seq = next_seq + 1`
  ).bind(prefix, year).run();
  const r = await env.DB.prepare(
    `SELECT next_seq FROM id_sequences WHERE prefix = ? AND year = ?`
  ).bind(prefix, year).first();
  /* The upserted row reflects the value AFTER insert/update, so the issued
     id is `next_seq - 1` for the insert path AND for the update path. */
  const seq = (r.next_seq - 1);
  return `${prefix}-${year}-${String(seq + 1).padStart(4, '0')}`;
}

function token32() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ───────────── transactions ───────────── */

async function createTransaction(request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { buyer_company, buyer_email, buyer_country, ergsn_partner, notes, rfq_tracker_id, rfq_summary } = body;
  if (!buyer_company || !buyer_email) return fail(400, 'buyer_company + buyer_email required', cors);
  const id = await nextId(env, 'TX');
  const now = Date.now();
  const tok = token32();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, buyer_token, notes, rfq_tracker_id, rfq_summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, buyer_company, buyer_email, buyer_country || null, ergsn_partner || null,
    tok, notes || null, rfq_tracker_id || null, rfq_summary || null, now, now
  ).run();
  await audit(env, { transaction_id: id, action: 'tx.create', to_status: 'open', actor: 'admin', detail: rfq_tracker_id ? `RFQ ${rfq_tracker_id}` : null });
  return ok({ ok: true, id, buyer_token: tok, buyer_url: `https://ergsn.net/trade-buyer.html?t=${tok}` }, cors);
}

async function listTransactions(url, env, cors) {
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  let q = `SELECT id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, created_at, updated_at FROM transactions`;
  const args = [];
  if (status) { q += ` WHERE status = ?`; args.push(status); }
  q += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);
  const r = await env.DB.prepare(q).bind(...args).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}

async function getTransaction(id, env, cors) {
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
  if (!tx) return fail(404, 'not found', cors);
  /* Include attachments inline so trade-tx.html can render them without a
     second round-trip. R2 binding is optional — skip silently if absent. */
  let attachments = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id, doc_id, kind, filename, mime_type, size_bytes, uploaded_by, notes, created_at
         FROM attachments WHERE transaction_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
    ).bind(id).all();
    attachments = r.results || [];
  } catch (_) {}
  return ok({ ok: true, transaction: tx, attachments }, cors);
}

async function patchTransaction(id, request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);

  /* Load current tx (needed for state validation + fan-out) */
  const cur = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
  if (!cur) return fail(404, 'transaction not found', cors);

  /* State machine — allow declared forward transitions, OR exactly one
     step backward when `body.revert === true`. Revert is audited
     separately so the log distinguishes "fix mistake" from progress. */
  if (body.status !== undefined && body.status !== cur.status) {
    const allowed = STATUS_NEXT[cur.status] || [];
    const isRevert = body.revert === true && STATUS_PREV[cur.status] === body.status;
    if (!allowed.includes(body.status) && !isRevert) {
      return fail(400, `invalid transition ${cur.status} → ${body.status}` + (STATUS_PREV[cur.status] ? ` (use revert:true to go back to ${STATUS_PREV[cur.status]})` : ''), cors);
    }
  }

  const allowed = ['status', 'notes', 'ergsn_partner', 'buyer_country'];
  const sets = [], args = [];
  for (const k of allowed) {
    if (body[k] !== undefined) { sets.push(`${k} = ?`); args.push(body[k]); }
  }
  if (!sets.length) return fail(400, 'no fields to update', cors);
  sets.push(`updated_at = ?`); args.push(Date.now());
  args.push(id);
  await env.DB.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).bind(...args).run();

  /* Status transition side effects: audit, buyer email, owner Telegram */
  if (body.status !== undefined && body.status !== cur.status) {
    const isRevert = body.revert === true;
    await audit(env, {
      transaction_id: id,
      action: isRevert ? 'tx.status-revert' : 'tx.status',
      from_status: cur.status,
      to_status: body.status,
      actor: 'admin',
      detail: body.revert_reason || null
    });
    if (!isRevert) {
      /* Forward fan-out — buyer email + owner Telegram. Skip on revert
         because we don't want to spam buyer with "wait, never mind". */
      fanOutOnStatusChange(env, { ...cur, status: body.status }, cur.status).catch(e => {
        console.log('fanOut error:', e && e.message);
      });
    } else {
      /* On revert, just notify owner (silent for buyer) */
      notifyTelegram(env, [
        '↩️ *Status reverted*',
        `${id} · ${cur.buyer_company}`,
        `${cur.status} → ${body.status}`,
        body.revert_reason ? 'Reason: ' + body.revert_reason : '',
        `Admin: https://ergsn.net/trade-tx.html?id=${id}`
      ].filter(Boolean).join('\n')).catch(() => {});
    }
    /* Phase 8-B — fire ERP webhooks on every status transition (even revert) */
    fireWebhooks(env, 'tx.status', { transaction_id: id, from: cur.status, to: body.status, revert: isRevert }).catch(() => {});
  }

  return ok({ ok: true }, cors);
}

/* ───────────── per-doc CRUD ───────────── */

async function createDoc(type, request, env, cors) {
  const meta = DOC_TABLES[type];
  if (!meta) return fail(400, 'unknown doc type', cors);
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { transaction_id, data } = body;
  if (!transaction_id || !data) return fail(400, 'transaction_id + data required', cors);
  const tx = await env.DB.prepare(`SELECT id FROM transactions WHERE id = ?`).bind(transaction_id).first();
  if (!tx) return fail(404, 'transaction not found', cors);
  const id = await nextId(env, meta.prefix);
  const now = Date.now();
  /* Promoted fields per doc type (best-effort; missing → null) */
  const cols = ['id', 'transaction_id', 'data', 'created_at', 'updated_at'];
  const vals = [id, transaction_id, JSON.stringify(data), now, now];
  const phs  = ['?', '?', '?', '?', '?'];
  if (type === 'quotation' || type === 'proforma' || type === 'commercial') {
    cols.push('total_amount', 'currency'); vals.push(data.total_amount || null, data.currency || null); phs.push('?', '?');
  }
  if (type === 'quotation') {
    cols.push('valid_until'); vals.push(data.valid_until || null); phs.push('?');
  }
  if (type === 'commercial') {
    cols.push('bl_number', 'container_no', 'shipped_at');
    vals.push(data.bl_number || null, data.container_no || null, data.shipped_at || null);
    phs.push('?', '?', '?');
  }
  if (type === 'packing') {
    cols.push('total_weight_kg', 'total_volume_m3', 'carton_count');
    vals.push(data.total_weight_kg || null, data.total_volume_m3 || null, data.carton_count || null);
    phs.push('?', '?', '?');
  }
  if (type === 'po') {
    cols.push('buyer_signed_at', 'buyer_signature');
    vals.push(data.buyer_signed_at || null, data.buyer_signature || null);
    phs.push('?', '?');
  }
  await env.DB.prepare(`INSERT INTO ${meta.table} (${cols.join(', ')}) VALUES (${phs.join(', ')})`).bind(...vals).run();
  await audit(env, { transaction_id, doc_id: id, action: 'doc.create', detail: type, actor: 'admin' });
  fireWebhooks(env, 'doc.create', { transaction_id, doc_id: id, type }).catch(() => {});
  return ok({ ok: true, id }, cors);
}

async function getDoc(type, id, env, cors) {
  const meta = DOC_TABLES[type];
  if (!meta) return fail(400, 'unknown doc type', cors);
  const r = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE id = ?`).bind(id).first();
  if (!r) return fail(404, 'not found', cors);
  return ok({ ok: true, doc: deserialiseDoc(r) }, cors);
}

async function patchDoc(type, id, request, env, cors) {
  const meta = DOC_TABLES[type];
  if (!meta) return fail(400, 'unknown doc type', cors);
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const sets = [], args = [];
  if (body.data !== undefined)            { sets.push('data = ?');            args.push(JSON.stringify(body.data)); }
  if (body.total_amount !== undefined)    { sets.push('total_amount = ?');    args.push(body.total_amount); }
  if (body.currency !== undefined)        { sets.push('currency = ?');        args.push(body.currency); }
  if (body.payment_status !== undefined)  { sets.push('payment_status = ?');  args.push(body.payment_status); }
  if (body.paid_at !== undefined)         { sets.push('paid_at = ?');         args.push(body.paid_at); }
  if (body.bl_number !== undefined)       { sets.push('bl_number = ?');       args.push(body.bl_number); }
  if (body.container_no !== undefined)    { sets.push('container_no = ?');    args.push(body.container_no); }
  if (body.shipped_at !== undefined)      { sets.push('shipped_at = ?');      args.push(body.shipped_at); }
  if (body.total_weight_kg !== undefined) { sets.push('total_weight_kg = ?'); args.push(body.total_weight_kg); }
  if (body.total_volume_m3 !== undefined) { sets.push('total_volume_m3 = ?'); args.push(body.total_volume_m3); }
  if (body.carton_count !== undefined)    { sets.push('carton_count = ?');    args.push(body.carton_count); }
  if (body.buyer_signed_at !== undefined) { sets.push('buyer_signed_at = ?'); args.push(body.buyer_signed_at); }
  if (body.buyer_signature !== undefined) { sets.push('buyer_signature = ?'); args.push(body.buyer_signature); }
  if (!sets.length) return fail(400, 'no fields to update', cors);
  sets.push('updated_at = ?'); args.push(Date.now());
  args.push(id);
  await env.DB.prepare(`UPDATE ${meta.table} SET ${sets.join(', ')} WHERE id = ?`).bind(...args).run();
  /* Resolve transaction_id for the audit row */
  const row = await env.DB.prepare(`SELECT transaction_id FROM ${meta.table} WHERE id = ?`).bind(id).first();
  await audit(env, {
    transaction_id: row && row.transaction_id || null, doc_id: id,
    action: 'doc.patch', detail: type + (body.payment_status ? ' payment=' + body.payment_status : ''),
    actor: 'admin'
  });
  return ok({ ok: true }, cors);
}

async function listDocsByTx(txId, env, cors) {
  const out = {};
  for (const [type, meta] of Object.entries(DOC_TABLES)) {
    const r = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE transaction_id = ? ORDER BY created_at`).bind(txId).all();
    out[type] = (r.results || []).map(deserialiseDoc);
  }
  return ok({ ok: true, docs: out }, cors);
}

function deserialiseDoc(row) {
  if (row && typeof row.data === 'string') {
    try { row.data = JSON.parse(row.data); } catch (_) {}
  }
  return row;
}

/* ───────────── buyer portal ───────────── */

async function handleBuyerPO(request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { token, data } = body;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return fail(400, 'invalid token', cors);
  if (!data) return fail(400, 'data required', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'transaction not found', cors);

  /* Tier-2 #15 — once a PO has been submitted on this transaction, lock further
     buyer-side submissions. Owner can still create POs admin-side. */
  if (tx.po_locked_at) return fail(409, 'A purchase order has already been submitted for this transaction. Please contact ERGSN if you need to amend it.', cors);

  const id = await nextId(env, 'PO');
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO purchase_orders (id, transaction_id, data, buyer_signed_at, buyer_signature, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tx.id, JSON.stringify(data), data.buyer_signed_at || now, data.buyer_signature || null, now, now).run();

  /* Status auto-flip + lock + audit */
  const prevStatus = tx.status;
  await env.DB.prepare(`UPDATE transactions SET status = 'po-received', po_locked_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, tx.id).run();
  await audit(env, {
    transaction_id: tx.id, doc_id: id,
    action: 'po.buyer-submit', from_status: prevStatus, to_status: 'po-received',
    actor: 'buyer', detail: data.buyer_signature ? 'signed:' + data.buyer_signature.slice(0, 60) : null
  });

  /* Owner alert via Telegram (fire-and-forget) */
  notifyTelegram(env, [
    '🟢 *Buyer PO submitted*',
    `Transaction: ${tx.id}`,
    `Buyer: ${tx.buyer_company} (${tx.buyer_email})`,
    `PO: ${id}`,
    `Total: ${data.total_amount || data.subtotal || ''} ${data.currency || ''}`,
    `Admin: https://ergsn.net/trade-tx.html?id=${tx.id}`
  ].join('\n')).catch(() => {});

  /* Confirmation email to buyer */
  const buyerHtml = `<p>Dear ${escHtml(tx.buyer_company)},</p>
    <p>We have received your purchase order <strong>${id}</strong> for transaction <strong>${tx.id}</strong>. Our trade desk will respond with a Proforma Invoice and payment instructions within 1 business day.</p>
    <p>You can review status at any time at the link previously sent — <a href="https://ergsn.net/trade-buyer.html?t=${token}">your buyer portal</a>.</p>`;
  sendBuyerEmail(env, {
    to: tx.buyer_email, subject: `ERGSN Purchase Order ${id} received — ${tx.buyer_company}`,
    htmlBody: buyerHtml, transaction_id: tx.id, doc_id: id, doc_type: 'po'
  }).catch(() => {});

  return ok({ ok: true, id }, cors);
}

async function handleBuyerView(url, env, cors) {
  const token = url.searchParams.get('t') || '';
  if (!/^[a-f0-9]{32}$/i.test(token)) return fail(400, 'invalid token', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'not found', cors);
  /* Buyer view exposes the token (it's how they got here). The page uses
     it to build attachment view URLs and POST to /buyer/po + /upload. */
  const docs = {};
  for (const [type, meta] of Object.entries(DOC_TABLES)) {
    /* Buyer sees only the latest revision per doc lineage — superseded
       rows are admin-only history. */
    const r = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE transaction_id = ? AND superseded_at IS NULL ORDER BY created_at`).bind(tx.id).all();
    docs[type] = (r.results || []).map(deserialiseDoc);
  }
  let attachments = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id, doc_id, kind, filename, mime_type, size_bytes, uploaded_by, notes, created_at
         FROM attachments WHERE transaction_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
    ).bind(tx.id).all();
    attachments = r.results || [];
  } catch (_) {}
  return ok({ ok: true, transaction: tx, docs, attachments }, cors);
}

/* ───────────── audit log ───────────── */

async function audit(env, ev) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (transaction_id, doc_id, action, from_status, to_status, detail, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ev.transaction_id || null, ev.doc_id || null, ev.action,
      ev.from_status || null, ev.to_status || null,
      ev.detail || null, ev.actor || 'system', Date.now()
    ).run();
  } catch (e) {
    console.log('audit insert failed:', e && e.message);
  }
}

async function listAuditByTx(txId, env, cors) {
  const r = await env.DB.prepare(
    `SELECT * FROM audit_log WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 200`
  ).bind(txId).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}

async function listAuditRecent(url, env, cors) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const r = await env.DB.prepare(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}

async function listEmailByTx(txId, env, cors) {
  const r = await env.DB.prepare(
    `SELECT * FROM email_log WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(txId).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}

/* ───────────── fan-out: Telegram + buyer email ───────────── */

async function notifyTelegram(env, text) {
  if (!env.TG_BOT || !env.TG_CHAT) return;  // not configured — silently skip
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TG_BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TG_CHAT,
        text: String(text).slice(0, 3800),
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
    return r.ok;
  } catch (e) {
    console.log('Telegram error:', e && e.message);
    return false;
  }
}

/* Server-side send via ergsn-mail /admin-send. Logs every send to email_log
   so admin tx detail page can render "this doc was sent to X on Y". */
async function sendBuyerEmail(env, payload) {
  const mailUrl = env.MAIL_URL || 'https://ergsn-mail.ceodon.workers.dev/admin-send';
  if (!env.ADMIN_KEY) {
    await logEmail(env, { ...payload, status: 'failed', detail: 'ADMIN_KEY not configured' });
    return false;
  }
  try {
    const r = await fetch(mailUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': env.ADMIN_KEY },
      body: JSON.stringify({
        to:        payload.to,
        subject:   payload.subject,
        htmlBody:  payload.htmlBody,
        locale:    payload.locale || 'en',
        replyTo:   payload.replyTo || 'ceodon@gmail.com',
        fromName:  payload.fromName || 'ERGSN Trade Desk'
      })
    });
    const j = await r.json().catch(() => ({}));
    const ok = r.ok && j.ok !== false;
    await logEmail(env, { ...payload, status: ok ? 'sent' : 'failed', detail: ok ? null : (j.error || 'http ' + r.status) });
    return ok;
  } catch (e) {
    await logEmail(env, { ...payload, status: 'failed', detail: String(e && e.message).slice(0, 200) });
    return false;
  }
}

async function logEmail(env, ev) {
  try {
    await env.DB.prepare(
      `INSERT INTO email_log (transaction_id, doc_id, doc_type, to_email, subject, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ev.transaction_id || null, ev.doc_id || null, ev.doc_type || null,
      ev.to || '', String(ev.subject || '').slice(0, 200),
      ev.status, ev.detail || null, Date.now()
    ).run();
  } catch (_) {}
}

/* Status transition fan-out — 1 Telegram + 1 buyer email per advance.
   Wording per status keeps the buyer informed without admin reach. */
async function fanOutOnStatusChange(env, tx, prevStatus) {
  const tgMsg = [
    `🟡 *Transaction status changed*`,
    `${tx.id} · ${tx.buyer_company}`,
    `${prevStatus} → ${tx.status}`,
    `Admin: https://ergsn.net/trade-tx.html?id=${tx.id}`
  ].join('\n');
  await notifyTelegram(env, tgMsg);

  const portalUrl = `https://ergsn.net/trade-buyer.html?t=${tx.buyer_token}`;
  const t = STATUS_LABELS[tx.status] || tx.status;
  const msgs = {
    quoted: {
      subject: `ERGSN — Quotation issued for transaction ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>A quotation has been issued for your inquiry. Please review at your buyer portal:</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>
        <p>Reply to this email if anything needs adjustment.</p>`
    },
    'po-received': {
      subject: `ERGSN — Purchase order received for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>Your purchase order has been received. Our team will issue a Proforma Invoice with payment details shortly.</p>
        <p>Status &amp; documents: <a href="${portalUrl}">${portalUrl}</a></p>`
    },
    'proforma-sent': {
      subject: `ERGSN — Proforma invoice ready for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>The proforma invoice for transaction <strong>${tx.id}</strong> is ready in your portal. Please review payment instructions and confirm wire transfer.</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>`
    },
    paid: {
      subject: `ERGSN — Payment confirmed for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>Payment for transaction <strong>${tx.id}</strong> has been confirmed. We will issue the Commercial Invoice and Packing List shortly and proceed with shipment.</p>`
    },
    'commercial-issued': {
      subject: `ERGSN — Commercial invoice issued for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>The Commercial Invoice for transaction <strong>${tx.id}</strong> is now available in your portal.</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>`
    },
    'packing-issued': {
      subject: `ERGSN — Packing list issued for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>The Packing List for transaction <strong>${tx.id}</strong> has been issued and is available in your portal.</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>`
    },
    shipped: {
      subject: `ERGSN — Shipment dispatched for ${tx.id}`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>Your shipment for transaction <strong>${tx.id}</strong> has been dispatched. Tracking and B/L details are in your portal.</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>`
    },
    closed: {
      subject: `ERGSN — Transaction ${tx.id} closed`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>Transaction <strong>${tx.id}</strong> is now closed. Thank you for choosing ERGSN. Final documents remain accessible at your portal.</p>
        <p><a href="${portalUrl}">${portalUrl}</a></p>`
    },
    cancelled: {
      subject: `ERGSN — Transaction ${tx.id} cancelled`,
      body: `<p>Dear ${escHtml(tx.buyer_company)},</p>
        <p>Transaction <strong>${tx.id}</strong> has been cancelled. Please contact our trade desk if this was unexpected.</p>`
    }
  };
  const m = msgs[tx.status];
  if (!m) return;
  await sendBuyerEmail(env, {
    to: tx.buyer_email, subject: m.subject, htmlBody: m.body,
    transaction_id: tx.id, doc_type: 'status'
  });
}

/* ───────────── public RFQ bridge ─────────────
   Called by index.html#rfq submitRFQ() right after the rfq-tracker /create.
   Origin-gated by CORS (matched). No admin key required, but we rate-limit
   by client IP via cf headers so this can't be flooded. */
async function handleRfqBridge(request, env, cors) {
  /* Reject if Origin didn't pass CORS allow-list. */
  if (!cors['Access-Control-Allow-Origin']) return fail(403, 'origin not allowed', cors);
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { buyer_company, buyer_email, buyer_country, ergsn_partner, rfq_tracker_id, rfq_summary } = body;
  if (!buyer_company || !buyer_email) return fail(400, 'buyer_company + buyer_email required', cors);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) return fail(400, 'invalid email', cors);

  const id  = await nextId(env, 'TX');
  const now = Date.now();
  const tok = token32();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, buyer_token,
        notes, rfq_tracker_id, rfq_summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, buyer_company.slice(0, 200), buyer_email.slice(0, 200), (buyer_country || '').slice(0, 100),
    (ergsn_partner || '').slice(0, 200), tok, null,
    (rfq_tracker_id || '').slice(0, 80), (rfq_summary || '').slice(0, 4000),
    now, now
  ).run();

  await audit(env, {
    transaction_id: id, action: 'tx.create-from-rfq',
    to_status: 'open', actor: 'system',
    detail: rfq_tracker_id ? `RFQ ${rfq_tracker_id}` : null
  });

  const portalUrl = `https://ergsn.net/trade-buyer.html?t=${tok}`;

  /* Owner Telegram alert — this is the same notification the rfq-tracker
     already sends, but with the trade-tx admin link added. */
  notifyTelegram(env, [
    '📥 *New RFQ → transaction created*',
    `${id} · ${buyer_company}`,
    `Email: ${buyer_email} (${buyer_country || '?'})`,
    rfq_tracker_id ? `RFQ Tracker: ${rfq_tracker_id}` : '',
    `Admin: https://ergsn.net/trade-tx.html?id=${id}`,
    `Buyer portal: ${portalUrl}`
  ].filter(Boolean).join('\n')).catch(() => {});

  /* Buyer welcome email with the portal link they can revisit any time */
  sendBuyerEmail(env, {
    to: buyer_email,
    subject: `ERGSN — your inquiry received (${id})`,
    htmlBody: `<p>Dear ${escHtml(buyer_company)},</p>
      <p>We have received your inquiry. Reference: <strong>${id}</strong>.</p>
      <p>You can revisit and track this transaction any time via your dedicated buyer portal:</p>
      <p><a href="${portalUrl}">${portalUrl}</a></p>
      <p>Our trade desk will respond with a quotation within 1 business day (KST, UTC+9).</p>`,
    transaction_id: id, doc_type: 'tx-create'
  }).catch(() => {});

  return ok({ ok: true, id, buyer_token: tok, buyer_url: portalUrl }, cors);
}

/* ───────────── Phase D — 1-click doc succession ─────────────
   Copies items + relevant per-type fields from a source doc to a new doc of
   another type. e.g. POST /doc/from/quotation/Q-2026-0001/to/proforma
   creates a fresh proforma seeded from the quote's line items + currency. */
async function createDocFromAnother(srcType, srcId, dstType, request, env, cors) {
  const srcMeta = DOC_TABLES[srcType], dstMeta = DOC_TABLES[dstType];
  if (!srcMeta || !dstMeta) return fail(400, 'unknown doc type', cors);
  const src = await env.DB.prepare(`SELECT * FROM ${srcMeta.table} WHERE id = ?`).bind(srcId).first();
  if (!src) return fail(404, 'source doc not found', cors);
  let srcData = {};
  try { srcData = JSON.parse(src.data); } catch (_) {}

  const overrides = (await safeJson(request)) || {};
  const data = {
    document_date: new Date().toISOString().slice(0, 10),
    currency:      srcData.currency || 'USD',
    items:         srcData.items || [],
    discount:      srcData.discount || 0,
    tax_pct:       srcData.tax_pct || 0,
    notes:         srcData.notes || '',
    subtotal:      srcData.subtotal || 0,
    total_amount:  srcData.total_amount || 0,
    /* per-type carry-over */
    ...(dstType === 'proforma' && srcData.payment_terms ? { payment_terms: srcData.payment_terms } : {}),
    ...(dstType === 'proforma' && srcData.delivery     ? { delivery: srcData.delivery }         : {}),
    ...(dstType === 'commercial' && srcData.incoterms  ? { incoterms: srcData.incoterms }       : {}),
    ...(dstType === 'commercial' && srcData.coo        ? { coo: srcData.coo }                   : { coo: 'Republic of Korea' }),
    ...(srcType === 'quotation' && srcData.buyer_ref   ? { quotation_id: srcId }                : {}),
    ...overrides   // any user-provided overrides win
  };

  const id = await nextId(env, dstMeta.prefix);
  const now = Date.now();
  const cols = ['id', 'transaction_id', 'data', 'created_at', 'updated_at'];
  const vals = [id, src.transaction_id, JSON.stringify(data), now, now];
  const phs  = ['?', '?', '?', '?', '?'];
  if (['quotation','proforma','commercial'].includes(dstType)) {
    cols.push('total_amount', 'currency'); vals.push(data.total_amount, data.currency); phs.push('?', '?');
  }
  if (dstType === 'commercial') { cols.push('bl_number', 'container_no', 'shipped_at'); vals.push(data.bl_number||null, data.container_no||null, data.shipped_at||null); phs.push('?','?','?'); }
  if (dstType === 'packing')    { cols.push('total_weight_kg', 'total_volume_m3', 'carton_count'); vals.push(data.total_weight_kg||null, data.total_volume_m3||null, data.carton_count||null); phs.push('?','?','?'); }
  await env.DB.prepare(`INSERT INTO ${dstMeta.table} (${cols.join(', ')}) VALUES (${phs.join(', ')})`).bind(...vals).run();
  await audit(env, {
    transaction_id: src.transaction_id, doc_id: id,
    action: 'doc.derive', detail: `from ${srcType} ${srcId} to ${dstType}`,
    actor: 'admin'
  });
  return ok({ ok: true, id, transaction_id: src.transaction_id }, cors);
}

/* ───────────── Phase D — buyer "Accept Quotation" → auto-PO ─────────────
   Creates a PO whose line items mirror the latest quotation. The buyer still
   sees the existing trade-doc-po.html for explicit signature, but this
   endpoint exists so the portal can offer a 1-click accept that pre-fills
   the form before signing. */
async function handleBuyerAcceptQuotation(request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { token, quotation_id, buyer_signature, buyer_ref } = body;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return fail(400, 'invalid token', cors);
  if (!buyer_signature) return fail(400, 'buyer_signature required', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'transaction not found', cors);
  if (tx.po_locked_at) return fail(409, 'A purchase order has already been submitted.', cors);

  /* Load the quotation (specific or most recent) */
  let q;
  if (quotation_id) {
    q = await env.DB.prepare(`SELECT * FROM quotations WHERE id = ? AND transaction_id = ?`).bind(quotation_id, tx.id).first();
  } else {
    q = await env.DB.prepare(`SELECT * FROM quotations WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1`).bind(tx.id).first();
  }
  if (!q) return fail(404, 'no quotation to accept', cors);
  let qData = {}; try { qData = JSON.parse(q.data); } catch (_) {}

  const id = await nextId(env, 'PO');
  const now = Date.now();
  const data = {
    document_date: new Date().toISOString().slice(0, 10),
    currency:  qData.currency || 'USD',
    items:     qData.items || [],
    subtotal:  qData.subtotal || 0,
    total_amount: qData.total_amount || 0,
    notes:     'Accepted from quotation ' + q.id,
    buyer_ref: buyer_ref || '',
    quotation_id: q.id,
    buyer_signed_at: now,
    buyer_signature
  };
  await env.DB.prepare(
    `INSERT INTO purchase_orders (id, transaction_id, data, buyer_signed_at, buyer_signature, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tx.id, JSON.stringify(data), now, buyer_signature, now, now).run();
  await env.DB.prepare(`UPDATE transactions SET status = 'po-received', po_locked_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, tx.id).run();
  await audit(env, {
    transaction_id: tx.id, doc_id: id,
    action: 'po.accept-quotation', from_status: tx.status, to_status: 'po-received',
    actor: 'buyer', detail: 'from ' + q.id
  });
  notifyTelegram(env, [
    '🟢 *Quotation accepted (auto-PO)*',
    `${tx.id} · ${tx.buyer_company}`,
    `From quotation ${q.id} → PO ${id}`,
    `Admin: https://ergsn.net/trade-tx.html?id=${tx.id}`
  ].join('\n')).catch(() => {});
  sendBuyerEmail(env, {
    to: tx.buyer_email,
    subject: `ERGSN Purchase Order ${id} received — quotation ${q.id} accepted`,
    htmlBody: `<p>Dear ${escHtml(tx.buyer_company)},</p>
      <p>Your acceptance of quotation <strong>${q.id}</strong> is confirmed; PO <strong>${id}</strong> has been recorded. Our team will issue a proforma invoice with payment instructions within 1 business day.</p>
      <p><a href="https://ergsn.net/trade-buyer.html?t=${token}">Open buyer portal</a></p>`,
    transaction_id: tx.id, doc_id: id, doc_type: 'po'
  }).catch(() => {});
  return ok({ ok: true, id, quotation_id: q.id }, cors);
}

/* ───────────── admin: send doc to buyer (server-side) ─────────────
   Renders the FULL doc body inline in the email so the buyer can save
   the message as PDF directly from any mail client — no separate
   attachment workflow required. (We don't have a headless-browser PDF
   path on Workers; inline HTML covers 95% of the use case.)
   Every send is logged to email_log. */
async function sendDocToBuyer(type, id, request, env, cors) {
  const meta = DOC_TABLES[type];
  if (!meta) return fail(400, 'unknown doc type', cors);
  const doc = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE id = ?`).bind(id).first();
  if (!doc) return fail(404, 'doc not found', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(doc.transaction_id).first();
  if (!tx) return fail(404, 'transaction not found', cors);

  const docViewUrl = `https://ergsn.net/trade-doc-view.html?type=${type}&id=${encodeURIComponent(id)}&t=${tx.buyer_token}`;
  const meta_t = { quotation:['Quotation','견적서'], po:['Purchase Order','발주서'], proforma:['Proforma Invoice','견적송장'], commercial:['Commercial Invoice','상업송장'], packing:['Packing List','포장명세서'] }[type];

  let data = {};
  try { data = JSON.parse(doc.data); } catch (_) {}

  /* Load seller settings + resolve seal URL (if uploaded) so the inline
     email matches the buyer-portal print view. */
  const settings = await loadSettings(env);
  const sealUrl = settings.seller_seal_r2_key
    ? `https://ergsn-trade-docs.ceodon.workers.dev/system/seal`
    : null;

  /* Render the whole document inline — bayer can save email as PDF. */
  const docInline = renderDocHtml(type, tx, data, id, settings, sealUrl);

  const html = `<p>Dear ${escHtml(tx.buyer_company)},</p>
    <p>${meta_t[0]} <strong>${id}</strong> for transaction <strong>${tx.id}</strong> is now available. The full document is included below — you can also <a href="${docViewUrl}">open it in your portal</a> to print.</p>
    <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
    ${docInline}
    <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
    <p style="font-size:12px;color:#666">Reply to this email if anything needs adjustment, or visit <a href="${docViewUrl}">your buyer portal</a>.</p>`;

  const sent = await sendBuyerEmail(env, {
    to: tx.buyer_email,
    subject: `ERGSN ${meta_t[0]} ${id} — ${tx.buyer_company}`,
    htmlBody: html, transaction_id: tx.id, doc_id: id, doc_type: type
  });
  if (sent) {
    await audit(env, {
      transaction_id: tx.id, doc_id: id, action: 'doc.send',
      detail: `${type} → ${tx.buyer_email}`, actor: 'admin'
    });
  }
  return ok({ ok: sent, sent_to: tx.buyer_email }, cors);
}

/* ───────────── server-side doc renderer ─────────────
   Mirrors scripts/trade-docs.js TD.buildPrintHtml so server-rendered
   inline emails look identical to the buyer-portal print view.
   `settings` is the result of loadSettings() — seller_biz_number,
   seller_representative, seller_phone, seller_seal_r2_key. */
function renderDocHtml(type, tx, data, docId, settings, sealAbsoluteUrl) {
  settings = settings || {};
  const meta_t = { quotation:['Quotation','견적서'], po:['Purchase Order','발주서'], proforma:['Proforma Invoice','견적송장'], commercial:['Commercial Invoice','상업송장'], packing:['Packing List','포장명세서'] }[type] || ['Document','문서'];
  const items = (data.items || []).map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${escHtml(r.desc || '')}</td>
      ${type==='commercial' ? `<td>${escHtml(r.hs || '')}</td>` : ''}
      <td style="text-align:right">${fmtN(r.qty, 0)} ${escHtml(r.unit || '')}</td>
      <td style="text-align:right">${fmtN(r.up)}</td>
      <td style="text-align:right">${fmtN(r.amt)}</td>
      ${type==='packing' ? `<td style="text-align:right">${fmtN(r.ctns,0)}</td><td style="text-align:right">${fmtN(r.nw)}</td><td style="text-align:right">${fmtN(r.gw)}</td><td>${escHtml(r.dims || '')}</td><td>${escHtml(r.marks || '')}</td>` : ''}
    </tr>`).join('');
  const extras = (() => {
    if (type === 'commercial') return `<p>
      <b>B/L:</b> ${escHtml(data.bl_number||'')} &middot; <b>Container:</b> ${escHtml(data.container_no||'')} &middot;
      <b>Incoterms:</b> ${escHtml(data.incoterms||'')} &middot; <b>COO:</b> ${escHtml(data.coo||'')}<br>
      ${data.port_loading ? '<b>POL:</b> ' + escHtml(data.port_loading) + ' &middot; ' : ''}
      ${data.port_discharge ? '<b>POD:</b> ' + escHtml(data.port_discharge) + ' &middot; ' : ''}
      ${data.vessel ? '<b>Vessel:</b> ' + escHtml(data.vessel) + (data.voyage ? ' (' + escHtml(data.voyage) + ')' : '') : ''}
      ${data.consignee ? '<br><b>Consignee:</b> ' + escHtml(data.consignee) : ''}
      ${data.notify_party ? '<br><b>Notify:</b> ' + escHtml(data.notify_party) : ''}
      ${data.shipping_marks ? '<br><b>Shipping Marks:</b> ' + escHtml(data.shipping_marks) : ''}
    </p>`;
    if (type === 'packing')    return `<p><b>Cartons:</b> ${data.carton_count||''} &middot; <b>Net:</b> ${fmtN(data.total_net_kg)} kg &middot; <b>Gross:</b> ${fmtN(data.total_weight_kg)} kg &middot; <b>Vol:</b> ${fmtN(data.total_volume_m3)} m³</p>`;
    if (type === 'quotation')  return data.valid_until ? `<p><b>Valid until:</b> ${new Date(data.valid_until).toISOString().slice(0,10)}</p>` : '';
    if (type === 'proforma')   return `<p>
      <b>Payment Terms:</b> ${escHtml(data.payment_terms||'')} &middot; <b>Delivery:</b> ${escHtml(data.delivery||'')}
      ${data.bank_name ? '<br><b>Bank:</b> ' + escHtml(data.bank_name) : ''}
      ${data.bank_account ? '<br><b>Account:</b> ' + escHtml(data.bank_account) : ''}
      ${data.bank_swift ? '<br><b>SWIFT:</b> ' + escHtml(data.bank_swift) : ''}
      ${data.bank_iban ? '<br><b>IBAN:</b> ' + escHtml(data.bank_iban) : ''}
      ${data.bank_beneficiary ? '<br><b>Beneficiary:</b> ' + escHtml(data.bank_beneficiary) : ''}
    </p>`;
    if (type === 'po') {
      const sig = data.buyer_signature && String(data.buyer_signature).startsWith('data:image')
        ? `<div style="margin-top:8px"><b>Buyer signature:</b> ${data.buyer_signature_name ? escHtml(data.buyer_signature_name) : ''}<br><img src="${escHtml(data.buyer_signature)}" alt="signature" style="max-height:80px;background:#fff;padding:4px;border:1px solid #ddd"></div>`
        : '';
      return (data.buyer_ref ? `<p><b>Buyer Ref:</b> ${escHtml(data.buyer_ref)}</p>` : '') + sig;
    }
    return '';
  })();
  const subtotal     = data.subtotal != null ? data.subtotal : (data.items || []).reduce((s,r) => s + (r.amt||0), 0);
  const discount     = data.discount || 0;
  const taxPct       = data.tax_pct || 0;
  const total_amount = data.total_amount != null ? data.total_amount : (subtotal - discount) * (1 + taxPct/100);

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#000;font-size:12px;line-height:1.4">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f0f0f;padding-bottom:8px;margin-bottom:14px">
        <div style="font-size:22px;font-weight:800;letter-spacing:.04em"><span style="color:#34d298">E</span>RGSN</div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800">${meta_t[0]}</div>
          <div style="font-size:11px;color:#666">${meta_t[1]} &middot; ${escHtml(docId || '')} &middot; TX ${escHtml(tx.id || '')}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px"><tr>
        <td style="vertical-align:top;width:50%;padding-right:12px">
          <div style="font-weight:700;color:#34d298;text-transform:uppercase;letter-spacing:.1em;font-size:10px;margin-bottom:4px">Seller</div>
          ${escHtml(SELLER_DEFAULT.name)}<br>
          ${escHtml(SELLER_DEFAULT.address)}<br>
          ${settings.seller_biz_number ? '<b>Business Reg. No.:</b> ' + escHtml(settings.seller_biz_number) + '<br>' : ''}
          ${settings.seller_representative ? '<b>Representative:</b> ' + escHtml(settings.seller_representative) + '<br>' : ''}
          ${settings.seller_phone ? '<b>Tel:</b> ' + escHtml(settings.seller_phone) + ' &middot; ' : ''}
          ${escHtml(SELLER_DEFAULT.website)}
        </td>
        <td style="vertical-align:top;width:50%;padding-left:12px">
          <div style="font-weight:700;color:#34d298;text-transform:uppercase;letter-spacing:.1em;font-size:10px;margin-bottom:4px">Buyer</div>
          ${escHtml(tx.buyer_company || '')}<br>
          ${escHtml(tx.buyer_email || '')}<br>
          ${escHtml(tx.buyer_country || '')}
        </td>
      </tr></table>
      <div style="margin-bottom:8px;font-size:11px"><b>Document Date:</b> ${escHtml(data.document_date || '')} &middot; <b>Currency:</b> ${escHtml(data.currency || '')} &middot; <b>Maker:</b> ${escHtml(tx.ergsn_partner || '')}</div>
      ${extras}
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:11px">
        <thead style="background:#0f0f0f;color:#fff">
          <tr>
            <th style="padding:6px;text-align:left">#</th><th style="padding:6px;text-align:left">Description</th>
            ${type==='commercial' ? '<th style="padding:6px">HS</th>' : ''}
            <th style="padding:6px;text-align:right">Qty</th>
            <th style="padding:6px;text-align:right">Unit Price</th>
            <th style="padding:6px;text-align:right">Amount</th>
            ${type==='packing' ? '<th>Ctns</th><th>NW</th><th>GW</th><th>Dims</th><th>Marks</th>' : ''}
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
      <table style="margin-left:auto;width:260px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border-top:2px solid #0f0f0f;padding-top:6px">
        <tr><td>Subtotal</td><td style="text-align:right">${fmtN(subtotal)}</td></tr>
        <tr><td>Discount</td><td style="text-align:right">-${fmtN(discount)}</td></tr>
        <tr><td>Tax (${taxPct}%)</td><td style="text-align:right">${fmtN((subtotal-discount)*taxPct/100)}</td></tr>
        <tr style="font-size:14px;font-weight:700;color:#34d298;border-top:1px solid #0f0f0f"><td>Total</td><td style="text-align:right">${fmtN(total_amount)}</td></tr>
      </table>
      ${data.notes ? `<div style="margin-top:18px;font-size:11px;border-top:1px dashed #999;padding-top:8px"><b>Notes:</b> ${escHtml(data.notes)}</div>` : ''}
      <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;font-size:10.5px">
        <div style="color:#444">
          ${settings.seller_representative ? '<div style="margin-bottom:4px"><b>Authorized Signatory:</b> ' + escHtml(settings.seller_representative) + '</div>' : ''}
          <div style="border-top:1px solid #888;padding-top:3px;width:200px;color:#888">Signature / 인감</div>
        </div>
        ${sealAbsoluteUrl ? '<img src="' + escHtml(sealAbsoluteUrl) + '" alt="ERGSN seal" style="height:88px;width:auto;opacity:.95">' : ''}
      </div>
      <div style="margin-top:18px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:6px">© 2013 ${escHtml(SELLER_DEFAULT.name)} &middot; ${escHtml(SELLER_DEFAULT.website)} &middot; Generated ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</div>
    </div>`;
}

function fmtN(n, d) {
  d = (d == null) ? 2 : d;
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!isFinite(v)) return '';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/* ───────────── Phase E + 8-A — AI quotation drafter (keyword-filtered catalog) ─────────────
   Worker fetches data/products.json once (cached 1h on Cloudflare's edge),
   then runs filterCatalogForAi() to slim the catalog down to ~5 candidate
   SKUs before sending to Claude. Drops input tokens from ~7.5k to ~600. */
let _catalogCache = null;
let _catalogAt = 0;
async function getCatalog() {
  /* In-Worker memory cache (per isolate) for 1 hour. */
  if (_catalogCache && (Date.now() - _catalogAt) < 3_600_000) return _catalogCache;
  try {
    const r = await fetch('https://ergsn.net/data/products.json', { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!r.ok) return [];
    const j = await r.json();
    /* products.json shape: { "$schema":..., "_doc":..., "products": [...] } */
    const list = Array.isArray(j) ? j : (j.products || []);
    _catalogCache = list; _catalogAt = Date.now();
    return list;
  } catch (_) { return []; }
}

async function aiDraftQuotation(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) return fail(503, 'ANTHROPIC_API_KEY not configured on this Worker', cors);
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { rfq_summary, transaction_id } = body;
  if (!rfq_summary) return fail(400, 'rfq_summary required', cors);

  /* Server-side catalog filter — see filterCatalogForAi() for heuristics */
  const fullCatalog = await getCatalog();
  const candidates  = filterCatalogForAi(fullCatalog, rfq_summary);

  const sys = `You are a senior trade-desk assistant at ERGSN, a Korean B2B export platform. Given a buyer RFQ summary and a short list of candidate SKUs, output a JSON object suitable for prefilling a quotation form. Respond with JSON ONLY — no prose, no markdown fences.

Schema: { "items": [{ "desc": string, "qty": number, "unit": string, "up": number }], "currency": "USD"|"EUR"|"KRW"|"JPY"|"CNY", "notes": string, "valid_until_days": number }

Rules:
- Prefer the candidate SKUs; if RFQ mentions an SKU not in the list, still include it (mark up=0 and add note "price TBD").
- Default unit: "EA". Default currency: "USD". Default valid_until_days: 30.
- If quantities aren't specified, use 1 and add a note saying so.
- Do not include tax/discount; admin sets those separately.
- Keep notes concise (under 240 chars).`;

  const userMsg = `RFQ Summary:\n${rfq_summary}\n\nCandidate SKUs (filtered to top ${candidates.length}):\n${JSON.stringify(candidates)}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    const j = await r.json();
    if (!r.ok) return fail(502, 'AI error: ' + (j.error && j.error.message || r.status), cors);
    const text = (j.content && j.content[0] && j.content[0].text) || '';
    /* Tolerate markdown fences just in case */
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch (e) { return fail(502, 'AI returned non-JSON: ' + cleaned.slice(0, 200), cors); }
    if (transaction_id) {
      await audit(env, {
        transaction_id, action: 'ai.draft-quotation',
        detail: `candidates=${candidates.length} items=${parsed.items?.length || 0} input_tokens~=${j.usage?.input_tokens || '?'}`,
        actor: 'admin'
      });
    }
    return ok({ ok: true, draft: parsed, candidates: candidates.length, usage: j.usage || null }, cors);
  } catch (e) {
    return fail(502, 'AI request failed: ' + (e.message || ''), cors);
  }
}

/* ───────────── CSV export ───────────── */

async function exportTransactionsCsv(url, env, cors) {
  const r = await env.DB.prepare(
    `SELECT id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, rfq_tracker_id, created_at, updated_at FROM transactions ORDER BY created_at DESC LIMIT 5000`
  ).all();
  const rows = r.results || [];
  const header = ['id','buyer_company','buyer_email','buyer_country','ergsn_partner','status','rfq_tracker_id','created_utc','updated_utc'];
  const csv = [header.join(',')].concat(rows.map(t => [
    t.id, t.buyer_company, t.buyer_email, t.buyer_country, t.ergsn_partner, t.status, t.rfq_tracker_id,
    new Date(t.created_at).toISOString(), new Date(t.updated_at).toISOString()
  ].map(csvEsc).join(','))).join('\n');
  return new Response(csv, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ergsn-transactions.csv"'
    }
  });
}

function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ───────────── attachments (R2) ─────────────
   - Admin can upload any kind (B/L scan, COA, COO, etc.)
   - Buyer (token-gated) can upload only `payment-proof`.
   - Buyers can read attachments belonging to their transaction; admin
     can read any. Files served from this Worker, never directly from R2,
     so we control ACL + audit. */

const ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;            // 12 MB
const ATTACHMENT_MIME_ALLOW = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/heic',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/csv', 'text/plain'
];

async function authForUpload(request, env) {
  /* Returns { actor, tx } or null. */
  const token = (request.headers.get('X-Buyer-Token') || '').trim();
  const adminKey = request.headers.get('X-Admin-Key') || '';
  if (env.ADMIN_KEY && adminKey === env.ADMIN_KEY) {
    return { actor: 'admin' };
  }
  if (/^[a-f0-9]{32}$/i.test(token)) {
    const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
    if (tx) return { actor: 'buyer', tx };
  }
  return null;
}

async function handleUpload(request, env, cors) {
  if (!env.FILES) return fail(503, 'R2 binding FILES not configured', cors);
  const auth = await authForUpload(request, env);
  if (!auth) return fail(401, 'unauthorized', cors);

  const ct = request.headers.get('Content-Type') || '';
  if (!ct.toLowerCase().startsWith('multipart/form-data')) return fail(400, 'multipart/form-data required', cors);
  let form;
  try { form = await request.formData(); } catch (e) { return fail(400, 'bad multipart', cors); }
  const file = form.get('file');
  if (!(file && typeof file === 'object' && file.arrayBuffer)) return fail(400, 'file field missing', cors);
  if (file.size > ATTACHMENT_MAX_BYTES) return fail(413, 'file too large (max 12 MB)', cors);
  const mime = (file.type || '').toLowerCase();
  if (mime && !ATTACHMENT_MIME_ALLOW.includes(mime)) return fail(415, 'unsupported mime: ' + mime, cors);

  const transaction_id = String(form.get('transaction_id') || '').trim();
  const doc_id         = String(form.get('doc_id') || '').trim() || null;
  const kind           = String(form.get('kind') || 'other').trim().toLowerCase();
  const notes          = String(form.get('notes') || '').slice(0, 500);

  /* Buyer can only upload to their own transaction, kind=payment-proof.
     Admin can use any kind including 'seal' (system-wide assets). */
  if (auth.actor === 'buyer') {
    if (!auth.tx || transaction_id !== auth.tx.id) return fail(403, 'wrong transaction', cors);
    if (kind !== 'payment-proof') return fail(403, 'buyer can only upload payment-proof', cors);
  }
  const VALID_KINDS = new Set(['bl','coa','coo','payment-proof','seal','other']);
  if (!VALID_KINDS.has(kind)) return fail(400, 'invalid kind', cors);
  if (!transaction_id) return fail(400, 'transaction_id required', cors);
  /* Admin path: ensure tx exists */
  const tx = auth.tx || await env.DB.prepare(`SELECT id, buyer_email, buyer_company FROM transactions WHERE id = ?`).bind(transaction_id).first();
  if (!tx) return fail(404, 'transaction not found', cors);

  const id = await nextId(env, 'AT');
  const safeName = String(file.name || 'upload').replace(/[^\w.\- ()]+/g, '_').slice(0, 200);
  const r2Key = `attachments/${transaction_id}/${id}/${safeName}`;
  const buf = await file.arrayBuffer();
  await env.FILES.put(r2Key, buf, { httpMetadata: { contentType: mime || 'application/octet-stream' } });
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO attachments (id, transaction_id, doc_id, kind, filename, mime_type, size_bytes, r2_key, uploaded_by, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, transaction_id, doc_id, kind, safeName, mime || null, buf.byteLength, r2Key, auth.actor, notes || null, now).run();
  await audit(env, {
    transaction_id, doc_id, action: 'attachment.upload',
    detail: kind + ':' + safeName + ' (' + buf.byteLength + 'b)', actor: auth.actor
  });

  /* Owner Telegram alert for every attachment — buyer uploads always
     trigger; admin uploads trigger only for non-trivial kinds (B/L, COA,
     COO, payment-proof) since admin obviously knows what they uploaded. */
  const adminNotableKinds = new Set(['bl', 'coa', 'coo', 'payment-proof']);
  const shouldAlert = auth.actor === 'buyer' || adminNotableKinds.has(kind);
  if (shouldAlert) {
    const emoji = kind === 'payment-proof' ? '💸' : (kind === 'bl' ? '📦' : '📎');
    notifyTelegram(env, [
      `${emoji} *Attachment uploaded* (${kind})`,
      `${transaction_id} · ${tx.buyer_company || ''}`,
      `File: ${safeName} (${(buf.byteLength/1024).toFixed(1)} KB) · by ${auth.actor}`,
      `Admin: https://ergsn.net/trade-tx.html?id=${transaction_id}`
    ].join('\n')).catch(() => {});
  }

  /* Phase 8-B — webhook fan-out */
  fireWebhooks(env, 'attachment.upload', { transaction_id, attachment_id: id, kind, size: buf.byteLength, by: auth.actor }).catch(() => {});

  return ok({ ok: true, id, filename: safeName, size: buf.byteLength }, cors);
}

async function deleteAttachment(id, env, cors) {
  if (!env.FILES) return fail(503, 'R2 binding FILES not configured', cors);
  const att = await env.DB.prepare(`SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
  if (!att) return fail(404, 'not found or already deleted', cors);
  /* Soft-delete in D1 (keep audit trail) + hard-delete in R2 (free storage) */
  const now = Date.now();
  await env.DB.prepare(`UPDATE attachments SET deleted_at = ? WHERE id = ?`).bind(now, id).run();
  try { await env.FILES.delete(att.r2_key); } catch (_) {}
  await audit(env, {
    transaction_id: att.transaction_id, doc_id: att.doc_id, action: 'attachment.delete',
    detail: att.kind + ':' + att.filename, actor: 'admin'
  });
  return ok({ ok: true }, cors);
}

async function handleFileGet(attId, url, env, cors) {
  if (!env.FILES) return fail(503, 'R2 binding FILES not configured', cors);
  const att = await env.DB.prepare(`SELECT * FROM attachments WHERE id = ?`).bind(attId).first();
  if (!att) return fail(404, 'not found', cors);

  /* Authorisation — admin OR buyer token matching the tx */
  const adminKey = (url.searchParams.get('admin') || '');         // optional query
  const headerKey = '';                                            // we read header below if available
  // (We can also accept X-Admin-Key but header forwarding through anchor links isn't possible; query param + token are the realistic options.)
  let authed = false;
  if (env.ADMIN_KEY && adminKey === env.ADMIN_KEY) authed = true;
  if (!authed) {
    const token = url.searchParams.get('t') || '';
    if (/^[a-f0-9]{32}$/i.test(token)) {
      const tx = await env.DB.prepare(`SELECT id FROM transactions WHERE buyer_token = ?`).bind(token).first();
      if (tx && tx.id === att.transaction_id) authed = true;
    }
  }
  if (!authed) return fail(401, 'unauthorized', cors);

  const obj = await env.FILES.get(att.r2_key);
  if (!obj) return fail(410, 'file gone (R2 miss)', cors);
  const headers = new Headers(cors);
  headers.set('Content-Type', att.mime_type || obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Disposition', `inline; filename="${att.filename.replace(/"/g, '')}"`);
  if (att.size_bytes) headers.set('Content-Length', String(att.size_bytes));
  return new Response(obj.body, { status: 200, headers });
}

async function handleAttachmentList(txId, url, env, cors) {
  /* admin OR buyer-token */
  let authed = false;
  /* admin (header) */
  // We can't read request headers here; the caller already passed the URL.
  // Instead this endpoint accepts two auth shapes:
  //   X-Admin-Key header (admin) — but route entry is already public so we
  //     can't enforce header here without a request reference. Easiest: also
  //     accept ?t=token. Admin can call from trade-tx.html which already has
  //     the admin key — we'll add a different route for admin via adminGate.
  // For now, only buyer-token flow is used by trade-buyer.html; admin reads
  // attachments via a server-side helper baked into trade-tx.html via the
  // admin /tx/:id endpoint (we extended getTransaction to include them).
  const token = url.searchParams.get('t') || '';
  if (/^[a-f0-9]{32}$/i.test(token)) {
    const tx = await env.DB.prepare(`SELECT id FROM transactions WHERE buyer_token = ?`).bind(token).first();
    if (tx && tx.id === txId) authed = true;
  }
  if (!authed) return fail(401, 'unauthorized', cors);

  const r = await env.DB.prepare(
    `SELECT id, doc_id, kind, filename, mime_type, size_bytes, uploaded_by, notes, created_at
       FROM attachments WHERE transaction_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
  ).bind(txId).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}

/* ───────────── Phase 8-A — rate limiting (D1-backed sliding minute) ───────────── */

async function rateLimit(request, env, path) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const bucket = `${ip}|${path}|${minute}`;
  try {
    /* Atomic upsert; if count exceeds limit we reject */
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET count = count + 1`
    ).bind(bucket, Date.now()).run();
    const r = await env.DB.prepare(`SELECT count FROM rate_limits WHERE bucket = ?`).bind(bucket).first();
    if (r && r.count > RATE_LIMIT_PER_MIN) return true;
    /* Garbage-collect old buckets occasionally (1 in 50 calls) */
    if (Math.random() < 0.02) {
      env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(Date.now() - 5 * 60_000).run().catch(() => {});
    }
  } catch (_) { /* If rate-limit table missing or D1 hiccup, fail-open */ }
  return false;
}

/* ───────────── Phase 8-A — system settings ───────────── */

async function loadSettings(env) {
  const r = await env.DB.prepare(`SELECT key, value FROM system_settings`).all();
  const out = {};
  for (const row of (r.results || [])) out[row.key] = row.value || '';
  return out;
}

async function getSettings(env, cors) {
  return ok({ ok: true, settings: await loadSettings(env) }, cors);
}

async function patchSettings(request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const allowed = new Set([
    'seller_biz_number', 'seller_representative', 'seller_phone',
    'seller_seal_r2_key',
    'reminder_quote_days', 'reminder_unpaid_days'
  ]);
  const now = Date.now();
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.has(k)) continue;
    await env.DB.prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(k, String(v == null ? '' : v).slice(0, 1000), now).run();
  }
  await audit(env, { action: 'settings.update', actor: 'admin', detail: Object.keys(body).join(',') });
  return ok({ ok: true }, cors);
}

async function serveSeal(env, cors) {
  if (!env.FILES) return fail(503, 'R2 not bound', cors);
  const settings = await loadSettings(env);
  const key = settings.seller_seal_r2_key || 'system/seal.png';
  const obj = await env.FILES.get(key);
  if (!obj) return fail(404, 'no seal uploaded', cors);
  const headers = new Headers(cors);
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/png');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(obj.body, { status: 200, headers });
}

/* ───────────── Phase 8-A — buyer token rotation ───────────── */

async function rotateBuyerToken(txId, env, cors) {
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(txId).first();
  if (!tx) return fail(404, 'not found', cors);
  const newTok = token32();
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE transactions SET buyer_token = ?, buyer_token_rotated_at = ?, updated_at = ? WHERE id = ?`
  ).bind(newTok, now, now, txId).run();
  await audit(env, { transaction_id: txId, action: 'tx.token-rotate', actor: 'admin' });
  return ok({ ok: true, buyer_token: newTok, buyer_url: `https://ergsn.net/trade-buyer.html?t=${newTok}` }, cors);
}

/* ───────────── Phase 8-A — doc revision ─────────────
   Creates a new row that supersedes the previous revision. The old row
   stays in the DB (with `superseded_at` set) so audit + history are
   preserved. Buyer portal listing filters out superseded rows. */
async function reviseDoc(type, srcId, request, env, cors) {
  const meta = DOC_TABLES[type];
  if (!meta) return fail(400, 'unknown doc type', cors);
  const src = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE id = ?`).bind(srcId).first();
  if (!src) return fail(404, 'source doc not found', cors);
  const body = await safeJson(request);
  if (!body || !body.data) return fail(400, 'data required', cors);

  /* Mark the source as superseded, then create a new row with revision++ */
  const now = Date.now();
  await env.DB.prepare(`UPDATE ${meta.table} SET superseded_at = ? WHERE id = ?`).bind(now, srcId).run();

  const id = await nextId(env, meta.prefix);
  const data = body.data;
  const cols = ['id','transaction_id','data','created_at','updated_at','revision','parent_doc_id'];
  const vals = [id, src.transaction_id, JSON.stringify(data), now, now, (src.revision || 1) + 1, srcId];
  const phs  = ['?','?','?','?','?','?','?'];
  if (['quotation','proforma','commercial'].includes(type)) {
    cols.push('total_amount','currency'); vals.push(data.total_amount || null, data.currency || null); phs.push('?','?');
  }
  if (type === 'quotation')  { cols.push('valid_until'); vals.push(data.valid_until || null); phs.push('?'); }
  if (type === 'commercial') { cols.push('bl_number','container_no','shipped_at'); vals.push(data.bl_number||null, data.container_no||null, data.shipped_at||null); phs.push('?','?','?'); }
  if (type === 'packing')    { cols.push('total_weight_kg','total_volume_m3','carton_count'); vals.push(data.total_weight_kg||null, data.total_volume_m3||null, data.carton_count||null); phs.push('?','?','?'); }
  if (type === 'po')         { cols.push('buyer_signed_at','buyer_signature'); vals.push(data.buyer_signed_at||null, data.buyer_signature||null); phs.push('?','?'); }
  await env.DB.prepare(`INSERT INTO ${meta.table} (${cols.join(', ')}) VALUES (${phs.join(', ')})`).bind(...vals).run();
  await audit(env, {
    transaction_id: src.transaction_id, doc_id: id,
    action: 'doc.revise', from_status: srcId, to_status: id,
    detail: `${type} v${(src.revision || 1)} → v${(src.revision || 1) + 1}`,
    actor: 'admin'
  });
  return ok({ ok: true, id, revision: (src.revision || 1) + 1, parent_doc_id: srcId }, cors);
}

/* ───────────── Phase 8-B — webhooks ───────────── */

async function listWebhooks(env, cors) {
  const r = await env.DB.prepare(`SELECT id, scope, url, events, enabled, created_at FROM webhooks ORDER BY created_at DESC`).all();
  return ok({ ok: true, items: r.results || [] }, cors);
}
async function createWebhook(request, env, cors) {
  const body = await safeJson(request);
  if (!body || !body.url) return fail(400, 'url required', cors);
  if (!/^https?:\/\//i.test(body.url)) return fail(400, 'url must be http(s)', cors);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO webhooks (scope, url, secret, events, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(body.scope || 'global', body.url.slice(0, 500), body.secret || null, body.events || 'all', now).run();
  return ok({ ok: true }, cors);
}
async function deleteWebhook(id, env, cors) {
  await env.DB.prepare(`DELETE FROM webhooks WHERE id = ?`).bind(parseInt(id, 10)).run();
  return ok({ ok: true }, cors);
}

/* Fire-and-forget webhook fan-out. Each delivery has a tight 5s timeout
   so a slow ERP endpoint doesn't block the user-facing response. */
async function fireWebhooks(env, event, payload) {
  let hooks;
  try {
    const r = await env.DB.prepare(`SELECT * FROM webhooks WHERE enabled = 1`).all();
    hooks = r.results || [];
  } catch (_) { return; }
  if (!hooks.length) return;
  const body = JSON.stringify({ event, at: Date.now(), payload });
  for (const h of hooks) {
    if (h.events !== 'all' && !h.events.split(',').map(s=>s.trim()).includes(event)) continue;
    /* Optional HMAC signature header */
    let sig = '';
    if (h.secret) {
      try {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(h.secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
        sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      } catch (_) {}
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    fetch(h.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sig ? { 'X-ERGSN-Signature': sig } : {}),
        'X-ERGSN-Event': event
      },
      body, signal: ctrl.signal
    }).catch(() => {}).finally(() => clearTimeout(t));
  }
}

/* ───────────── Phase 8-B — stats dashboard ─────────────
   Aggregates for the owner's at-a-glance view. Single round-trip. */
async function getStats(url, env, cors) {
  const days = Math.min(parseInt(url.searchParams.get('days') || '90', 10), 365);
  const since = Date.now() - days * 86_400_000;
  const [byStatus, byMonth, recent, openValue] = await Promise.all([
    env.DB.prepare(`SELECT status, COUNT(*) AS n FROM transactions GROUP BY status`).all(),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at/1000, 'unixepoch') AS month, COUNT(*) AS n FROM transactions WHERE created_at >= ? GROUP BY month ORDER BY month`
    ).bind(since).all(),
    env.DB.prepare(`SELECT id, buyer_company, buyer_country, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 10`).all(),
    env.DB.prepare(
      `SELECT SUM(total_amount) AS total, currency FROM proforma_invoices WHERE payment_status != 'paid' AND superseded_at IS NULL GROUP BY currency`
    ).all()
  ]);
  return ok({
    ok: true,
    by_status:  byStatus.results || [],
    by_month:   byMonth.results || [],
    recent:     recent.results || [],
    unpaid_value: openValue.results || []
  }, cors);
}

/* ───────────── Phase 8-B — CSV import ─────────────
   Accepts a text/csv body with header `buyer_company,buyer_email,buyer_country,ergsn_partner,notes`.
   Each row creates a transaction; nothing else. Idempotency via buyer_email
   uniqueness is NOT enforced (importer's job). */
async function importTransactionsCsv(request, env, cors) {
  const text = await request.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return fail(400, 'no rows', cors);
  const header = lines[0].split(',').map(s => s.trim());
  const idx = (k) => header.indexOf(k);
  if (idx('buyer_company') < 0 || idx('buyer_email') < 0) return fail(400, 'header must include buyer_company and buyer_email', cors);
  const created = [];
  for (let i = 1; i < lines.length && created.length < 500; i++) {
    const cols = parseCsvLine(lines[i]);
    const company = cols[idx('buyer_company')];
    const email   = cols[idx('buyer_email')];
    if (!company || !email) continue;
    const id = await nextId(env, 'TX');
    const now = Date.now();
    const tok = token32();
    await env.DB.prepare(
      `INSERT INTO transactions (id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, buyer_token, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
    ).bind(
      id, company, email,
      idx('buyer_country') >= 0 ? cols[idx('buyer_country')] : null,
      idx('ergsn_partner') >= 0 ? cols[idx('ergsn_partner')] : null,
      tok,
      idx('notes') >= 0 ? cols[idx('notes')] : 'imported',
      now, now
    ).run();
    await audit(env, { transaction_id: id, action: 'tx.import', actor: 'admin' });
    created.push({ id, buyer_token: tok });
  }
  return ok({ ok: true, count: created.length, created }, cors);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') q = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/* ───────────── Phase 8-B — buyer reject quotation ───────────── */

async function handleBuyerRejectQuotation(request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const { token, quotation_id, reason } = body;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return fail(400, 'invalid token', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'transaction not found', cors);
  await audit(env, {
    transaction_id: tx.id, doc_id: quotation_id || null,
    action: 'quotation.reject', actor: 'buyer',
    detail: (reason || '').slice(0, 500)
  });
  notifyTelegram(env, [
    '⛔ *Quotation rejected by buyer*',
    `${tx.id} · ${tx.buyer_company}`,
    `Quotation: ${quotation_id || '(latest)'}`,
    `Reason: ${reason || '(not given)'}`,
    `Admin: https://ergsn.net/trade-tx.html?id=${tx.id}`
  ].join('\n')).catch(() => {});
  /* Don't auto-flip status — owner can choose to revise the quote, cancel
     the transaction, or just talk to the buyer. */
  return ok({ ok: true }, cors);
}

/* ───────────── Phase 8-B — Cron scheduled handler ─────────────
   Sweeps for buyer reminders. Runs once a day per wrangler config. */
async function handleScheduled(env, event) {
  const settings = await loadSettings(env);
  const quoteDays  = parseInt(settings.reminder_quote_days || '3', 10);
  const unpaidDays = parseInt(settings.reminder_unpaid_days || '7', 10);
  const now = Date.now();
  let sentExpiry = 0, sentUnpaid = 0;

  /* Quotations expiring within `quoteDays` days, not yet superseded,
     transaction still open/quoted, no PO yet */
  try {
    const ds = quoteDays * 86_400_000;
    const r = await env.DB.prepare(
      `SELECT q.id AS quote_id, q.valid_until, t.id AS tx_id, t.buyer_company, t.buyer_email, t.buyer_token, t.status
         FROM quotations q
         JOIN transactions t ON t.id = q.transaction_id
        WHERE q.superseded_at IS NULL
          AND q.valid_until IS NOT NULL
          AND q.valid_until > ?
          AND q.valid_until <= ?
          AND t.status IN ('open','quoted')
          AND t.po_locked_at IS NULL`
    ).bind(now, now + ds).all();
    for (const row of (r.results || [])) {
      const portal = `https://ergsn.net/trade-buyer.html?t=${row.buyer_token}`;
      const days = Math.max(1, Math.round((row.valid_until - now) / 86_400_000));
      await sendBuyerEmail(env, {
        to: row.buyer_email,
        subject: `ERGSN — your quotation ${row.quote_id} expires in ${days} day${days > 1 ? 's' : ''}`,
        htmlBody: `<p>Dear ${escHtml(row.buyer_company)},</p>
          <p>Your quotation <strong>${row.quote_id}</strong> for transaction <strong>${row.tx_id}</strong> is set to expire on <strong>${new Date(row.valid_until).toISOString().slice(0,10)}</strong>.</p>
          <p>Open your buyer portal to accept the quote with one click: <a href="${portal}">${portal}</a></p>
          <p>If you'd like a revision (different quantity, alternate model, updated incoterms), reply to this email and our team will issue a fresh version within 1 business day.</p>`,
        transaction_id: row.tx_id, doc_id: row.quote_id, doc_type: 'quotation-expiry-reminder'
      });
      sentExpiry++;
    }
  } catch (e) { console.log('quote reminder error:', e && e.message); }

  /* Proformas where status == 'proforma-sent' for >= unpaidDays days */
  try {
    const cutoff = now - unpaidDays * 86_400_000;
    const r = await env.DB.prepare(
      `SELECT p.id AS pi_id, p.created_at, t.id AS tx_id, t.buyer_company, t.buyer_email, t.buyer_token
         FROM proforma_invoices p
         JOIN transactions t ON t.id = p.transaction_id
        WHERE t.status = 'proforma-sent'
          AND p.payment_status != 'paid'
          AND p.superseded_at IS NULL
          AND p.created_at <= ?`
    ).bind(cutoff).all();
    for (const row of (r.results || [])) {
      const portal = `https://ergsn.net/trade-buyer.html?t=${row.buyer_token}`;
      await sendBuyerEmail(env, {
        to: row.buyer_email,
        subject: `ERGSN — payment reminder for proforma ${row.pi_id}`,
        htmlBody: `<p>Dear ${escHtml(row.buyer_company)},</p>
          <p>This is a friendly reminder that proforma invoice <strong>${row.pi_id}</strong> for transaction <strong>${row.tx_id}</strong> remains unpaid.</p>
          <p>Once payment is received, we will issue your Commercial Invoice and Packing List and proceed with shipment.</p>
          <p>You can review the proforma and upload your wire transfer slip directly at your portal: <a href="${portal}">${portal}</a></p>
          <p>If there is anything blocking the payment, just reply to this email — our team is happy to adjust terms or split into deposit + balance.</p>`,
        transaction_id: row.tx_id, doc_id: row.pi_id, doc_type: 'proforma-unpaid-reminder'
      });
      sentUnpaid++;
    }
  } catch (e) { console.log('unpaid reminder error:', e && e.message); }

  const summary = `expiry=${sentExpiry} unpaid=${sentUnpaid}`;
  await env.DB.prepare(
    `INSERT INTO cron_runs (job, ran_at, ok, notes) VALUES ('reminders', ?, 1, ?)`
  ).bind(now, summary).run().catch(() => {});
  if (sentExpiry + sentUnpaid > 0) {
    notifyTelegram(env, `⏰ *Daily reminder digest*\n${summary}`).catch(() => {});
  }
  return summary;
}

/* ───────────── Phase 8-A — products.json keyword matching for AI draft ─────────────
   Filters the catalog client-supplies down to ~5 candidates so the AI
   prompt stays under 1k input tokens (vs ~7.5k if we sent the full file).
   Match heuristics, in order:
     1. exact SKU/part-number substring match in the RFQ summary
     2. sector keyword match
     3. fall back to one product per active sector (overview) */
function filterCatalogForAi(catalog, rfqSummary) {
  if (!Array.isArray(catalog)) return [];
  const norm = String(rfqSummary || '').toLowerCase();
  const exact = [];
  const sectorHits = [];
  const sectorOverview = new Map();

  for (const p of catalog) {
    if (!p || !p.id) continue;
    const id   = String(p.id).toLowerCase();
    const name = String(p.name || '').toLowerCase();
    const sec  = String(p.sector || '').toLowerCase();
    /* 1. exact id/part hit */
    const idHit = id && norm.includes(id);
    /* 2. model name token hit (DL-10X, HYGEN, Rosetta, RAY-1 etc.) */
    const tokens = name.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
    const nameHit = tokens.some(t => norm.includes(t));
    /* 3. sector mention */
    const secHit = sec && (
      norm.includes(sec.replace(/^k-/, '')) ||
      norm.includes(sec)
    );
    if (idHit || nameHit) exact.push(p);
    else if (secHit) sectorHits.push(p);
    if (sec && !sectorOverview.has(sec)) sectorOverview.set(sec, p);
  }
  /* dedupe + cap at 5 */
  const seen = new Set();
  const picked = [];
  for (const p of exact.concat(sectorHits)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id); picked.push(p);
    if (picked.length >= 5) break;
  }
  /* If none matched, send 1-per-sector as overview (~9 SKUs but compact). */
  if (!picked.length) for (const p of sectorOverview.values()) picked.push(p);
  /* Strip heavy fields — keep only what AI actually needs */
  return picked.map(p => ({
    id: p.id, name: p.name, sector: p.sector,
    desc: (p.desc || '').slice(0, 200),
    price: p.price || null, moq: p.moq || null,
    incoterms: p.incoterms || null
  }));
}

/* ───────────── helpers ───────────── */

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return null; }
}
