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
 *      ALLOW_ORIGIN = https://ergsn.net,https://ceodon.github.io
 *                     (comma-separated list; keep both during domain migration)
 *
 * Public routes:
 *   GET  /debug                                → binding diagnostics
 *   POST /create  body: { submission }         → creates row, returns { id }
 *                                                (server-side appends buyer cf.country)
 *   GET  /status?id=XXX                        → returns { id, stage, createdAt, updatedAt, notes }
 *   GET  /partner/metrics?token=xxx&range=30   → partner analytics dashboard payload
 *                                                (auth = opaque access_token in query)
 *
 * Admin routes (require X-Admin-Key header):
 *   POST /update           body: { id, stage, notes }
 *   POST /partner/create   body: { id, company_name, tier, sector, product_ids }
 *                          → returns { id, access_token, dashboard_url }
 *   POST /partner/rotate   body: { id }  → issues new access_token
 *   GET  /partner/list                   → lists partners (no tokens)
 */
const STAGES = ['received', 'reviewed', 'quoted', 'in_production', 'shipped', 'closed'];

function parseAllow(raw) {
  return (raw || '*').split(',').map(s => s.trim()).filter(Boolean);
}
function cors(origin, allowList) {
  const wildcard = allowList.includes('*');
  const matched = wildcard ? '*' : (allowList.includes(origin) ? origin : '');
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return (t + r).toUpperCase();
}
function genToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/[+/=]/g, '').slice(0, 32);
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
  await db.prepare(`CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'verified',
    sector TEXT,
    product_ids TEXT NOT NULL DEFAULT '',
    access_token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    token_rotated_at INTEGER
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_partners_token ON partners(access_token)`).run();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowList = parseAllow(env.ALLOW_ORIGIN);
    const matched = allowList.includes('*') ? '*' : (allowList.includes(origin) ? origin : '');
    const headers = cors(origin, allowList);
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const j = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

    if (!env.RFQ || typeof env.RFQ.prepare !== 'function') {
      return j({ ok: false, error: 'D1 database RFQ is not bound. Check Worker Settings → Bindings (type: D1 Database, name: RFQ).' }, 500);
    }

    try { await ensureSchema(env.RFQ); } catch(e) {
      return j({ ok: false, error: 'schema init failed: ' + (e.message || e) }, 500);
    }

    // POST /create — publicly accessible from the site
    if (request.method === 'POST' && path.endsWith('/create')) {
      if (!matched) return j({ ok: false, error: 'origin not allowed' }, 403);
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const raw = body.submission || {};
      // Capture server-side country from Cloudflare so partner analytics has
      // a canonical source even when buyer's self-reported country is blank.
      const enriched = { ...raw, _server: { cf_country: (request.cf && request.cf.country) || '', received_at: Date.now() } };
      const submission = JSON.stringify(enriched);
      if (submission.length > 8192) return j({ ok: false, error: 'submission too large (max 8KB)' }, 413);
      const id = genId();
      const now = Date.now();
      const notes = 'Your request has been received. We will review within 1 business day (KST).';
      await env.RFQ.prepare('INSERT INTO rfq (id, stage, createdAt, updatedAt, submission, notes) VALUES (?1, ?2, ?3, ?3, ?4, ?5)')
        .bind(id, 'received', now, submission, notes).run();
      return j({ ok: true, id });
    }

    // GET /status?id=XXX
    if (request.method === 'GET' && path.endsWith('/status')) {
      const id = (url.searchParams.get('id') || '').trim().toUpperCase();
      if (!id) return j({ ok: false, error: 'missing id' }, 400);
      const row = await env.RFQ.prepare('SELECT id, stage, createdAt, updatedAt, notes FROM rfq WHERE id = ?1').bind(id).first();
      if (!row) return j({ ok: false, error: 'not found' }, 404);
      return j({
        ok: true,
        id: row.id,
        stage: row.stage,
        stages: STAGES,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        notes: row.notes || ''
      });
    }

    // GET /partner/metrics?token=xxx&range=30
    // Returns analytics JSON for the partner whose access_token matches.
    // Token acts as both identifier and authz — rotate via /partner/rotate if leaked.
    if (request.method === 'GET' && path.endsWith('/partner/metrics')) {
      const token = (url.searchParams.get('token') || '').trim();
      const range = Math.max(1, Math.min(365, parseInt(url.searchParams.get('range'), 10) || 30));
      if (!token) return j({ ok: false, error: 'missing token' }, 400);
      const partner = await env.RFQ.prepare('SELECT id, company_name, tier, sector, product_ids, created_at FROM partners WHERE access_token = ?1').bind(token).first();
      if (!partner) return j({ ok: false, error: 'invalid token' }, 404);

      const products = String(partner.product_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const productSet = new Set(products.map(p => p.toUpperCase()));
      const since = Date.now() - (range * 86400000);
      const prevSince = since - (range * 86400000);

      // Pull both current and previous window so we can compute deltas.
      const rowsRes = await env.RFQ.prepare('SELECT id, stage, createdAt, submission FROM rfq WHERE createdAt >= ?1 ORDER BY createdAt DESC').bind(prevSince).all();
      const rows = rowsRes.results || [];

      const countryCounts = {};
      const stageCounts = { received: 0, reviewed: 0, quoted: 0, in_production: 0, shipped: 0, closed: 0 };
      const dailySeries = {};
      const recent = [];
      let currentCount = 0;
      let prevCount = 0;

      for (const r of rows) {
        let s = {};
        try { s = JSON.parse(r.submission || '{}'); } catch { continue; }
        const models = Array.isArray(s.models) ? s.models : [];
        if (!models.some(m => productSet.has(String(m).toUpperCase()))) continue;

        if (r.createdAt >= since) {
          currentCount++;
          const ctry = (s._server && s._server.cf_country) || s.country || '';
          if (ctry) countryCounts[ctry] = (countryCounts[ctry] || 0) + 1;
          if (stageCounts[r.stage] !== undefined) stageCounts[r.stage]++;
          const d = new Date(r.createdAt).toISOString().slice(0, 10);
          dailySeries[d] = (dailySeries[d] || 0) + 1;
          if (recent.length < 10) {
            // Mask PII — only company name + country + tier + stage shown to partner.
            recent.push({
              id: r.id,
              stage: r.stage,
              createdAt: r.createdAt,
              country: ctry || 'Unknown',
              company: s.company || '',
              tier: s.tier || '',
              models: models.filter(m => productSet.has(String(m).toUpperCase()))
            });
          }
        } else {
          prevCount++;
        }
      }

      // Zero-filled daily series for the full range.
      const series = [];
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        series.push({ date: d, count: dailySeries[d] || 0 });
      }

      // Simple benchmark: count partners in same sector and compare RFQ volumes.
      // Phase 0 computes only the count — percentile ranking is added in Phase 1.
      let sectorPartnerCount = 0;
      if (partner.sector) {
        const b = await env.RFQ.prepare('SELECT COUNT(*) AS n FROM partners WHERE sector = ?1').bind(partner.sector).first();
        sectorPartnerCount = (b && b.n) || 0;
      }

      return j({
        ok: true,
        partner: {
          id: partner.id,
          company_name: partner.company_name,
          tier: partner.tier,
          sector: partner.sector || '',
          product_ids: products,
          created_at: partner.created_at
        },
        range_days: range,
        generated_at: Date.now(),
        kpis: {
          total_rfqs: currentCount,
          prev_total_rfqs: prevCount,
          unique_countries: Object.keys(countryCounts).length,
          stage_counts: stageCounts
        },
        daily_series: series,
        top_countries: Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => ({ code, count })),
        recent_rfqs: recent,
        benchmark: {
          sector: partner.sector || '',
          sector_partner_count: sectorPartnerCount
        }
      });
    }

    // POST /update — admin only
    if (request.method === 'POST' && path.endsWith('/update')) {
      const key = request.headers.get('X-Admin-Key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return j({ ok: false, error: 'unauthorized' }, 401);
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const id = (body.id || '').trim().toUpperCase();
      const stage = body.stage;
      if (!id || !STAGES.includes(stage)) return j({ ok: false, error: 'invalid id/stage' }, 400);
      const existing = await env.RFQ.prepare('SELECT id, stage, notes FROM rfq WHERE id = ?1').bind(id).first();
      if (!existing) return j({ ok: false, error: 'not found' }, 404);
      const fromIdx = STAGES.indexOf(existing.stage);
      const toIdx = STAGES.indexOf(stage);
      if (toIdx < fromIdx) return j({ ok: false, error: 'stage cannot go backwards (' + existing.stage + ' -> ' + stage + ')' }, 400);
      let notes = (typeof body.notes === 'string' && body.notes.length) ? body.notes : existing.notes;
      if (typeof notes === 'string' && notes.length > 2000) notes = notes.slice(0, 2000);
      const now = Date.now();
      await env.RFQ.prepare('UPDATE rfq SET stage = ?1, notes = ?2, updatedAt = ?3 WHERE id = ?4').bind(stage, notes, now, id).run();
      return j({ ok: true, id, stage, updatedAt: now });
    }

    // POST /partner/create — admin only — provisions a partner account.
    if (request.method === 'POST' && path.endsWith('/partner/create')) {
      const key = request.headers.get('X-Admin-Key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return j({ ok: false, error: 'unauthorized' }, 401);
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const id = String(body.id || '').trim();
      const name = String(body.company_name || '').trim();
      const tier = String(body.tier || 'verified').trim();
      const sector = String(body.sector || '').trim();
      const productIds = Array.isArray(body.product_ids) ? body.product_ids.join(',') : String(body.product_ids || '');
      if (!id || !name) return j({ ok: false, error: 'missing id or company_name' }, 400);
      const token = genToken();
      const now = Date.now();
      try {
        await env.RFQ.prepare('INSERT INTO partners (id, company_name, tier, sector, product_ids, access_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, name, tier, sector, productIds, token, now).run();
      } catch (e) {
        return j({ ok: false, error: 'insert failed (duplicate id?): ' + (e.message || e) }, 400);
      }
      return j({ ok: true, id, access_token: token, dashboard_url: 'https://ergsn.net/partner-dashboard.html?t=' + token });
    }

    // POST /partner/rotate — admin only — issues a new token (invalidating the old one).
    if (request.method === 'POST' && path.endsWith('/partner/rotate')) {
      const key = request.headers.get('X-Admin-Key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return j({ ok: false, error: 'unauthorized' }, 401);
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const id = String(body.id || '').trim();
      if (!id) return j({ ok: false, error: 'missing id' }, 400);
      const token = genToken();
      const now = Date.now();
      const result = await env.RFQ.prepare('UPDATE partners SET access_token = ?1, token_rotated_at = ?2 WHERE id = ?3').bind(token, now, id).run();
      if (!result.meta || result.meta.changes === 0) return j({ ok: false, error: 'partner not found' }, 404);
      return j({ ok: true, id, access_token: token, dashboard_url: 'https://ergsn.net/partner-dashboard.html?t=' + token });
    }

    // GET /partner/list — admin only — returns all partners (no tokens leaked).
    if (request.method === 'GET' && path.endsWith('/partner/list')) {
      const key = request.headers.get('X-Admin-Key') || '';
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return j({ ok: false, error: 'unauthorized' }, 401);
      const res = await env.RFQ.prepare('SELECT id, company_name, tier, sector, product_ids, created_at, token_rotated_at FROM partners ORDER BY created_at DESC').all();
      return j({ ok: true, partners: res.results || [] });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
