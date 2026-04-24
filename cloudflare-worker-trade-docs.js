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

const VERSION = 'trade-docs-2026-04-25-v1';

const DOC_TABLES = {
  quotation:  { table: 'quotations',          prefix: 'Q'  },
  po:         { table: 'purchase_orders',     prefix: 'PO' },
  proforma:   { table: 'proforma_invoices',   prefix: 'PI' },
  commercial: { table: 'commercial_invoices', prefix: 'CI' },
  packing:    { table: 'packing_lists',       prefix: 'PL' }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

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
  const { buyer_company, buyer_email, buyer_country, ergsn_partner, notes } = body;
  if (!buyer_company || !buyer_email) return fail(400, 'buyer_company + buyer_email required', cors);
  const id = await nextId(env, 'TX');
  const now = Date.now();
  const tok = token32();
  await env.DB.prepare(
    `INSERT INTO transactions (id, buyer_company, buyer_email, buyer_country, ergsn_partner, status, buyer_token, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
  ).bind(id, buyer_company, buyer_email, buyer_country || null, ergsn_partner || null, tok, notes || null, now, now).run();
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
  return ok({ ok: true, transaction: tx }, cors);
}

async function patchTransaction(id, request, env, cors) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  const allowed = ['status', 'notes', 'ergsn_partner', 'buyer_country'];
  const sets = [], args = [];
  for (const k of allowed) {
    if (body[k] !== undefined) { sets.push(`${k} = ?`); args.push(body[k]); }
  }
  if (!sets.length) return fail(400, 'no fields to update', cors);
  sets.push(`updated_at = ?`); args.push(Date.now());
  args.push(id);
  await env.DB.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).bind(...args).run();
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
  const tx = await env.DB.prepare(`SELECT id FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'transaction not found', cors);
  const id = await nextId(env, 'PO');
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO purchase_orders (id, transaction_id, data, buyer_signed_at, buyer_signature, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, tx.id, JSON.stringify(data), data.buyer_signed_at || now, data.buyer_signature || null, now, now).run();
  await env.DB.prepare(`UPDATE transactions SET status = 'po-received', updated_at = ? WHERE id = ?`).bind(now, tx.id).run();
  return ok({ ok: true, id }, cors);
}

async function handleBuyerView(url, env, cors) {
  const token = url.searchParams.get('t') || '';
  if (!/^[a-f0-9]{32}$/i.test(token)) return fail(400, 'invalid token', cors);
  const tx = await env.DB.prepare(`SELECT * FROM transactions WHERE buyer_token = ?`).bind(token).first();
  if (!tx) return fail(404, 'not found', cors);
  /* Buyer view never returns the token field again */
  delete tx.buyer_token;
  const docs = {};
  for (const [type, meta] of Object.entries(DOC_TABLES)) {
    const r = await env.DB.prepare(`SELECT * FROM ${meta.table} WHERE transaction_id = ? ORDER BY created_at`).bind(tx.id).all();
    docs[type] = (r.results || []).map(deserialiseDoc);
  }
  return ok({ ok: true, transaction: tx, docs }, cors);
}

/* ───────────── helpers ───────────── */

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return null; }
}
