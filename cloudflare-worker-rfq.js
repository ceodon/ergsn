/**
 * ERGSN RFQ Tracker — Cloudflare Worker + D1 SQL database
 *
 * This worker uses D1 (SQL) bound as env.RFQ. Schema is auto-created on first use.
 *
 * Deployment (if starting fresh):
 * 1. Cloudflare → Workers & Pages → D1 → Create database: ergsn-rfq
 * 2. Create Worker: ergsn-rfq-tracker → paste this file → Deploy
 * 3. Settings → Bindings → Add binding → D1 Database:
 *      Variable name: RFQ
 *      D1 database:   ergsn-rfq
 * 4. Settings → Variables & Secrets:
 *      ADMIN_KEY    = (any random 32+ char string — keep private)
 *      ALLOW_ORIGIN = https://ceodon.github.io
 *
 * Routes:
 *   GET  /debug                          → binding diagnostics
 *   POST /create  body: { submission }   → creates row, returns { id }
 *   GET  /status?id=XXX                  → returns { id, stage, createdAt, updatedAt, notes }
 *   POST /update  header: X-Admin-Key    → body: { id, stage, notes }
 */
const STAGES = ['received', 'reviewed', 'quoted', 'in_production', 'shipped', 'closed'];

function cors(origin, allow) {
  const ok = allow === '*' || origin === allow;
  return {
    'Access-Control-Allow-Origin': ok ? (allow === '*' ? '*' : allow) : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age': '86400'
  };
}
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return (t + r).toUpperCase();
}
async function ensureSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS rfq (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'received',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    submission TEXT,
    notes TEXT
  )`).run();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOW_ORIGIN || '*';
    const headers = cors(origin, allow);
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    if (!env.RFQ || typeof env.RFQ.prepare !== 'function') {
      return new Response(JSON.stringify({ ok: false, error: 'D1 database RFQ is not bound. Check Worker Settings → Bindings (type: D1 Database, name: RFQ).' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    try { await ensureSchema(env.RFQ); } catch(e) {
      return new Response(JSON.stringify({ ok: false, error: 'schema init failed: ' + (e.message || e) }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // POST /create — publicly accessible from the site
    if (request.method === 'POST' && path.endsWith('/create')) {
      if (allow !== '*' && origin !== allow) {
        return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const submission = JSON.stringify(body.submission || {});
      if (submission.length > 8192) {
        return new Response(JSON.stringify({ ok: false, error: 'submission too large (max 8KB)' }), { status: 413, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const id = genId();
      const now = Date.now();
      const notes = 'Your request has been received. We will review within 1 business day (KST).';
      await env.RFQ.prepare('INSERT INTO rfq (id, stage, createdAt, updatedAt, submission, notes) VALUES (?1, ?2, ?3, ?3, ?4, ?5)')
        .bind(id, 'received', now, submission, notes).run();
      return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // GET /status?id=XXX
    if (request.method === 'GET' && path.endsWith('/status')) {
      const id = (url.searchParams.get('id') || '').trim().toUpperCase();
      if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing id' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      const row = await env.RFQ.prepare('SELECT id, stage, createdAt, updatedAt, notes FROM rfq WHERE id = ?1').bind(id).first();
      if (!row) return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({
        ok: true,
        id: row.id,
        stage: row.stage,
        stages: STAGES,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        notes: row.notes || ''
      }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // POST /update — admin only
    if (request.method === 'POST' && path.endsWith('/update')) {
      const key = request.headers.get('X-Admin-Key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const id = (body.id || '').trim().toUpperCase();
      const stage = body.stage;
      if (!id || !STAGES.includes(stage)) return new Response(JSON.stringify({ ok: false, error: 'invalid id/stage' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      const existing = await env.RFQ.prepare('SELECT id, stage, notes FROM rfq WHERE id = ?1').bind(id).first();
      if (!existing) return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
      const fromIdx = STAGES.indexOf(existing.stage);
      const toIdx = STAGES.indexOf(stage);
      if (toIdx < fromIdx) {
        return new Response(JSON.stringify({ ok: false, error: 'stage cannot go backwards (' + existing.stage + ' -> ' + stage + ')' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      let notes = (typeof body.notes === 'string' && body.notes.length) ? body.notes : existing.notes;
      if (typeof notes === 'string' && notes.length > 2000) notes = notes.slice(0, 2000);
      const now = Date.now();
      await env.RFQ.prepare('UPDATE rfq SET stage = ?1, notes = ?2, updatedAt = ?3 WHERE id = ?4').bind(stage, notes, now, id).run();
      return new Response(JSON.stringify({ ok: true, id, stage, updatedAt: now }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
