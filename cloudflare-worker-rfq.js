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
  const isErgsn = /^https:\/\/([a-z0-9-]+\.)?ergsn\.net$/i.test(origin);
  const matched = wildcard ? '*' : (allowList.includes(origin) || isErgsn ? origin : '');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Cf-Access-Jwt-Assertion',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (matched) {
    headers['Access-Control-Allow-Origin'] = matched;
    /* Specific-origin echoes can carry credentials; the wildcard cannot. */
    if (matched !== '*') headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

/* ─── Cloudflare Access JWT verification (defense in depth) ───────────────
 * Mirrors the verifier in cloudflare-worker-trade-docs.js so this Worker
 * can also validate signed CF Access JWTs at the edge. Even when the
 * request reaches us through CF Access, we re-verify the signature so
 * a misconfigured Access policy or accidentally-public hostname cannot
 * grant admin access on its own.
 *
 * Secrets required (set via `wrangler secret put`):
 *   CF_ACCESS_TEAM = <team-name>     (e.g. "ergsn")
 *   CF_ACCESS_AUD  = <application AUD tag>
 *
 * If those secrets are absent, the JWT path silently fails — caller
 * falls through to the X-Admin-Key recovery path. */
let _jwksCache = null;
const JWKS_TTL_MS = 60 * 60 * 1000;
async function fetchJwks(team) {
  if (_jwksCache && (Date.now() - _jwksCache.fetchedAt) < JWKS_TTL_MS) return _jwksCache.keys;
  const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Error('JWKS fetch failed: ' + r.status);
  const data = await r.json();
  _jwksCache = { keys: data.keys || [], fetchedAt: Date.now() };
  return _jwksCache.keys;
}
function _b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function _b64urlJson(s) { return JSON.parse(new TextDecoder().decode(_b64urlBytes(s))); }
async function verifyAccessJwt(token, env) {
  if (!env.CF_ACCESS_TEAM || !env.CF_ACCESS_AUD) throw new Error('CF Access secrets not configured');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const header = _b64urlJson(parts[0]);
  const payload = _b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('unexpected alg');
  if (!header.kid) throw new Error('no kid');
  const keys = await fetchJwks(env.CF_ACCESS_TEAM);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('no JWKS key for kid');
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, _b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) throw new Error('signature invalid');
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 60) throw new Error('iat in future');
  if (payload.iss !== `https://${env.CF_ACCESS_TEAM}.cloudflareaccess.com`) throw new Error('bad iss');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.CF_ACCESS_AUD)) throw new Error('aud mismatch');
  if (!payload.email) throw new Error('no email claim');
  return { email: String(payload.email).toLowerCase(), sub: payload.sub || null };
}

/* Dual-auth helper. Returns {ok, source, email, error} where source is
 * 'cf-access' (verified JWT) or 'admin-key' (X-Admin-Key matches secret).
 * Order: JWT preferred. JWT-present-but-invalid fails closed. */
async function adminAuth(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || request.headers.get('cf-access-jwt-assertion') || '';
  if (jwt) {
    try {
      const { email } = await verifyAccessJwt(jwt, env);
      return { ok: true, source: 'cf-access', email };
    } catch (_) {
      return { ok: false, error: 'invalid CF Access JWT' };
    }
  }
  const key = request.headers.get('X-Admin-Key') || '';
  if (env.ADMIN_KEY && key === env.ADMIN_KEY) return { ok: true, source: 'admin-key', email: null };
  return { ok: false, error: 'unauthorized' };
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
    const isErgsn = /^https:\/\/([a-z0-9-]+\.)?ergsn\.net$/i.test(origin);
    const matched = allowList.includes('*') ? '*' : (allowList.includes(origin) || isErgsn ? origin : '');
    const headers = cors(origin, allowList);
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const url = new URL(request.url);
    /* Strip the same-origin Admin Hub mount prefix so admin.ergsn.net/api/rfq/*
       and the legacy *.workers.dev path-space share one router. */
    let pathname = url.pathname;
    if (pathname === '/api/rfq' || pathname === '/api/rfq/') pathname = '/';
    else if (pathname.startsWith('/api/rfq/')) pathname = pathname.slice('/api/rfq'.length);
    const path = pathname.replace(/\/$/, '');
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
      const auth = await adminAuth(request, env);
      if (!auth.ok) return j({ ok: false, error: auth.error || 'unauthorized' }, 401);
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
      const auth = await adminAuth(request, env);
      if (!auth.ok) return j({ ok: false, error: auth.error || 'unauthorized' }, 401);
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
      const auth = await adminAuth(request, env);
      if (!auth.ok) return j({ ok: false, error: auth.error || 'unauthorized' }, 401);
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
      const auth = await adminAuth(request, env);
      if (!auth.ok) return j({ ok: false, error: auth.error || 'unauthorized' }, 401);
      const res = await env.RFQ.prepare('SELECT id, company_name, tier, sector, product_ids, created_at, token_rotated_at FROM partners ORDER BY created_at DESC').all();
      return j({ ok: true, partners: res.results || [] });
    }

    // GET /admin/item-metrics?range=30 — admin only — aggregates ALL RFQs
    // by product (model name), sector, country, stage, and time series.
    // Powers admin-analytics.html (ergsn.net/admin-analytics).
    if (request.method === 'GET' && path.endsWith('/admin/item-metrics')) {
      const auth = await adminAuth(request, env);
      if (!auth.ok) return j({ ok: false, error: auth.error || 'unauthorized' }, 401);
      const range = Math.max(1, Math.min(365, parseInt(url.searchParams.get('range'), 10) || 30));
      const since = Date.now() - (range * 86400000);
      const prevSince = since - (range * 86400000);

      // Build product → sector lookup from partners table (one model can map
      // to one sector via the owning partner). Models without a mapped
      // partner are bucketed under 'Other'.
      const partnerRows = await env.RFQ.prepare('SELECT product_ids, sector FROM partners').all();
      const productSector = {};
      for (const p of (partnerRows.results || [])) {
        const sec = (p.sector || 'Other').trim();
        const ids = String(p.product_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const id of ids) productSector[id.toUpperCase()] = sec;
      }
      // Hardcoded fallback for known model prefixes (covers products without
      // a partner row yet — DL = K-Security, HYGEN = K-Energy, etc.).
      function sectorFor(model) {
        const u = String(model).toUpperCase();
        if (productSector[u]) return productSector[u];
        if (u.startsWith('DL-'))      return 'K-Security';
        if (u.startsWith('HYGEN'))    return 'K-Energy';
        if (u.startsWith('ROSETTA'))  return 'K-Bio';
        if (u.startsWith('RAY-'))     return 'K-Bio';
        if (u.startsWith('DDELL'))    return 'K-Beauty';
        if (u.startsWith('K-TOUR'))   return 'K-Tourism Assets';
        return 'Other';
      }

      // Pull current + previous window so we can compute deltas.
      const rowsRes = await env.RFQ.prepare('SELECT id, stage, createdAt, submission FROM rfq WHERE createdAt >= ?1 ORDER BY createdAt DESC').bind(prevSince).all();
      const rows = rowsRes.results || [];

      const productAgg  = {};                      // model → { count, stages, top_country, last_at, sector }
      const sectorAgg   = {};                      // sector → { count, products: Set }
      const countryAgg  = {};                      // country → count
      const stageAgg    = { received: 0, reviewed: 0, quoted: 0, in_production: 0, shipped: 0, closed: 0 };
      const tierAgg     = {};                      // tier → count
      const dailySeries = {};                      // YYYY-MM-DD → count
      const recent      = [];
      let currentCount = 0, prevCount = 0;

      for (const r of rows) {
        let s = {};
        try { s = JSON.parse(r.submission || '{}'); } catch { continue; }
        const isCurrent = r.createdAt >= since;
        if (!isCurrent) { prevCount++; continue; }
        currentCount++;

        const ctry = (s._server && s._server.cf_country) || s.country || '';
        if (ctry) countryAgg[ctry] = (countryAgg[ctry] || 0) + 1;
        if (stageAgg[r.stage] !== undefined) stageAgg[r.stage]++;
        const tier = s.tier || 'Unqualified';
        tierAgg[tier] = (tierAgg[tier] || 0) + 1;
        const d = new Date(r.createdAt).toISOString().slice(0, 10);
        dailySeries[d] = (dailySeries[d] || 0) + 1;

        const models = Array.isArray(s.models) ? s.models : [];
        const mappedSectors = new Set();
        for (const m of models) {
          const mu = String(m).toUpperCase();
          const sec = sectorFor(m);
          mappedSectors.add(sec);
          if (!productAgg[mu]) {
            productAgg[mu] = { model: m, count: 0, stages: { received:0, reviewed:0, quoted:0, in_production:0, shipped:0, closed:0 }, countries: {}, last_at: 0, sector: sec };
          }
          const a = productAgg[mu];
          a.count++;
          if (a.stages[r.stage] !== undefined) a.stages[r.stage]++;
          if (ctry) a.countries[ctry] = (a.countries[ctry] || 0) + 1;
          if (r.createdAt > a.last_at) a.last_at = r.createdAt;
        }
        for (const sec of mappedSectors) {
          if (!sectorAgg[sec]) sectorAgg[sec] = { count: 0, products: new Set() };
          sectorAgg[sec].count++;
          for (const m of models) sectorAgg[sec].products.add(String(m).toUpperCase());
        }

        if (recent.length < 20) {
          recent.push({
            id: r.id,
            stage: r.stage,
            createdAt: r.createdAt,
            country: ctry || 'Unknown',
            company: s.company || '',
            email: s.email || '',
            tier: s.tier || '',
            models: models,
            qty: s.qty || '',
            incoterms: s.incoterms || ''
          });
        }
      }

      // Reshape product → array sorted by count
      const byProduct = Object.values(productAgg).map(a => ({
        model: a.model,
        sector: a.sector,
        count: a.count,
        stages: a.stages,
        last_at: a.last_at,
        top_country: Object.entries(a.countries).sort((x, y) => y[1] - x[1])[0]?.[0] || ''
      })).sort((x, y) => y.count - x.count);

      const bySector = Object.entries(sectorAgg).map(([sector, v]) => ({
        sector,
        count: v.count,
        products: v.products.size
      })).sort((x, y) => y.count - x.count);

      const byCountry = Object.entries(countryAgg).sort((a, b) => b[1] - a[1])
        .slice(0, 12).map(([code, count]) => ({ code, count }));

      const series = [];
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        series.push({ date: d, count: dailySeries[d] || 0 });
      }

      return j({
        ok: true,
        range_days: range,
        generated_at: Date.now(),
        kpis: {
          total_rfqs: currentCount,
          prev_total_rfqs: prevCount,
          unique_products: byProduct.length,
          unique_countries: byCountry.length,
          stage_counts: stageAgg,
          tier_counts: tierAgg
        },
        by_product: byProduct,
        by_sector: bySector,
        by_country: byCountry,
        daily_series: series,
        recent_rfqs: recent
      });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
