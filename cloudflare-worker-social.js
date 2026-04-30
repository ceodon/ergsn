/* ERGSN Social Poster Worker — Phase 1 (skeleton)
 * ═════════════════════════════════════════════════════════════════════════
 * Cross-posts one composer-authored message to multiple SNS:
 *   Facebook Page · Instagram · Threads · LinkedIn · Naver Blog (manual)
 * + AI draft (Anthropic), R2 image library + Vision-matched product
 * imagery, scheduled fan-out, post-publish insights loop.
 *
 * This file is the Phase 1 SCAFFOLD. What works in this phase:
 *   - Routing under both `*.workers.dev` and `admin.ergsn.net/api/social/*`
 *   - Dual-auth gate: CF Access JWT (preferred) or X-Admin-Key fallback
 *   - CORS that auto-allows *.ergsn.net + emits Allow-Credentials
 *   - Posts CRUD (draft/scheduled, no actual fan-out yet)
 *   - Image upload to R2 + image library listing/serve
 *   - Audit-log hook into the shared admin_audit_log on ergsn-trade-docs
 *   - Stubbed endpoints for OAuth, AI, publishing, insights — return
 *     `{ ok: true, stub: true, message: "..." }` with the future phase
 *     labelled, so the UI can be built and tested end-to-end.
 *
 * Phase 2 (Meta OAuth + FB/IG/Threads publish), Phase 3 (LinkedIn),
 * Phase 5 (Anthropic AI draft + Vision match + image gen), Phase 6
 * (insights cron), Phase 7 (scheduled fan-out cron) replace the stubs.
 *
 * Bindings (see wrangler.social.jsonc):
 *   DB           — D1 ergsn-social (this Worker's primary store)
 *   AUDIT_DB     — D1 ergsn-trade-docs (shared admin_audit_log table)
 *   FILES        — R2 ergsn-social-media (post images)
 * Secrets:
 *   ADMIN_KEY                              — recovery / off-Hub fallback
 *   CF_ACCESS_TEAM, CF_ACCESS_AUD          — JWT verification
 *   ANTHROPIC_API_KEY                      — Phase 5
 *   META_APP_ID, META_APP_SECRET           — Phase 2 OAuth
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET — Phase 3 OAuth
 *   ALLOW_ORIGIN                           — comma list (auto-allows *.ergsn.net regardless)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* Strip the same-origin Admin Hub mount prefix so admin.ergsn.net/api/social/*
       and the legacy *.workers.dev path-space share one router. */
    let pathname = url.pathname;
    if (pathname === '/api/social' || pathname === '/api/social/') pathname = '/';
    else if (pathname.startsWith('/api/social/')) pathname = pathname.slice('/api/social'.length);
    const path = pathname.replace(/\/$/, '') || '/';

    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      /* health / liveness */
      if (path === '/' && request.method === 'GET') {
        return ok({ ok: true, name: 'ergsn-social', phase: 1, alive: true }, cors);
      }
      if (path === '/health' && request.method === 'GET') return ok({ ok: true }, cors);

      /* ─── Posts ───────────────────────────────────────────────────────── */
      if (path === '/posts' && request.method === 'GET')
        return adminGate(request, env, cors, (ctx) => listPosts(url, env, cors, ctx));
      if (path === '/posts' && request.method === 'POST')
        return adminGate(request, env, cors, (ctx) => createPost(request, env, cors, ctx));

      const postOne = path.match(/^\/posts\/([a-zA-Z0-9_-]+)$/);
      if (postOne && request.method === 'GET')
        return adminGate(request, env, cors, (ctx) => getPost(postOne[1], env, cors, ctx));
      if (postOne && request.method === 'PATCH')
        return adminGate(request, env, cors, (ctx) => patchPost(postOne[1], request, env, cors, ctx));
      if (postOne && request.method === 'DELETE')
        return adminGate(request, env, cors, (ctx) => deletePost(postOne[1], env, cors, ctx));

      const postPub = path.match(/^\/posts\/([a-zA-Z0-9_-]+)\/publish$/);
      if (postPub && request.method === 'POST')
        return adminGate(request, env, cors, (ctx) => publishPostStub(postPub[1], env, cors, ctx));

      /* ─── Images ──────────────────────────────────────────────────────── */
      if (path === '/images' && request.method === 'GET')
        return adminGate(request, env, cors, (ctx) => listImages(url, env, cors, ctx));
      if (path === '/images' && request.method === 'POST')
        return adminGate(request, env, cors, (ctx) => uploadImage(request, env, cors, ctx));

      const imgOne = path.match(/^\/images\/([a-zA-Z0-9_-]+)$/);
      /* Image binary fetch: served behind the same auth gate so a leaked
         ID alone doesn't expose the binary. */
      if (imgOne && request.method === 'GET')
        return adminGate(request, env, cors, () => serveImage(imgOne[1], env, cors));
      if (imgOne && request.method === 'DELETE')
        return adminGate(request, env, cors, (ctx) => deleteImage(imgOne[1], env, cors, ctx));

      /* ─── OAuth (Phase 2/3 fills these in) ────────────────────────────── */
      if (path === '/oauth/start' && request.method === 'GET')
        return adminGate(request, env, cors, () => stub('OAuth start — Phase 2 (Meta) / Phase 3 (LinkedIn)', { provider: url.searchParams.get('provider') }, cors));
      /* Callback intentionally NOT behind adminGate: the OAuth provider
         hits this URL directly with no admin headers. Phase 2/3 will
         validate via the state parameter + provider exchange. */
      if (path === '/oauth/callback' && request.method === 'GET')
        return ok({ ok: false, error: 'OAuth callback — Phase 2/3 not implemented yet' }, cors);
      if (path === '/oauth/status' && request.method === 'GET')
        return adminGate(request, env, cors, () => listOauthStatus(env, cors));
      if (path === '/oauth/disconnect' && request.method === 'POST')
        return adminGate(request, env, cors, (ctx) => stub('OAuth disconnect — Phase 2/3', {}, cors));

      /* ─── AI (Phase 5) ────────────────────────────────────────────────── */
      if (path === '/ai/draft' && request.method === 'POST')
        return adminGate(request, env, cors, () => stub('AI draft — Phase 5 (Anthropic)', {}, cors));
      if (path === '/ai/match-image' && request.method === 'POST')
        return adminGate(request, env, cors, () => stub('AI image match against R2 product library — Phase 5', {}, cors));
      if (path === '/ai/generate-image' && request.method === 'POST')
        return adminGate(request, env, cors, () => stub('AI image generation — Phase 5 (provider TBD)', {}, cors));
      if (path === '/ai/translate' && request.method === 'POST')
        return adminGate(request, env, cors, () => stub('Multi-locale translation — Phase 5', {}, cors));

      /* ─── Insights (Phase 6) ──────────────────────────────────────────── */
      if (path === '/insights' && request.method === 'GET')
        return adminGate(request, env, cors, () => stub('Insights aggregate — Phase 6', { rows: [] }, cors));
      const insOne = path.match(/^\/insights\/([a-zA-Z0-9_-]+)$/);
      if (insOne && request.method === 'GET')
        return adminGate(request, env, cors, () => stub('Per-post insights — Phase 6', { post_id: insOne[1] }, cors));

      /* ─── Templates (Phase 5 helper) ──────────────────────────────────── */
      if (path === '/templates' && request.method === 'GET')
        return adminGate(request, env, cors, (ctx) => listTemplates(env, cors, ctx));

      return fail(404, 'not found: ' + path, cors);
    } catch (e) {
      return fail(500, 'server error: ' + (e.message || e), cors);
    }
  }
};

/* ═════════════════════════════════════════════════════════════════════════
   Auth + CORS
   ═════════════════════════════════════════════════════════════════════════ */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allow = (env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
  const isErgsn = /^https:\/\/([a-z0-9-]+\.)?ergsn\.net$/i.test(origin);
  const matched = allow.includes('*') ? '*' : (allow.includes(origin) || isErgsn ? origin : '');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Cf-Access-Jwt-Assertion',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (matched) {
    headers['Access-Control-Allow-Origin'] = matched;
    if (matched !== '*') headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

/* dual-auth: CF Access JWT (preferred — gives us the verified email for
   audit) or X-Admin-Key (off-Hub recovery path). Returns ctx with actor
   info to the handler. */
async function adminGate(request, env, cors, handler) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || readCookie(request, 'CF_Authorization');
  let ctx = { actor: null, source: null, email: null };
  if (jwt && env.CF_ACCESS_TEAM && env.CF_ACCESS_AUD) {
    const v = await verifyJwt(jwt, env);
    if (v.ok) ctx = { actor: v.email, source: 'cf-access', email: v.email };
    else if (!validAdminKey(request, env)) return fail(401, 'JWT invalid: ' + v.reason, cors);
    else ctx = { actor: 'admin-key', source: 'admin-key', email: null };
  } else if (validAdminKey(request, env)) {
    ctx = { actor: 'admin-key', source: 'admin-key', email: null };
  } else {
    return fail(401, 'unauthorized — provide CF Access JWT or X-Admin-Key', cors);
  }
  return handler(ctx);
}

function validAdminKey(request, env) {
  const key = request.headers.get('X-Admin-Key') || '';
  return !!(key && env.ADMIN_KEY && key === env.ADMIN_KEY);
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

/* JWT verifier — slim mirror of the trade-docs verifier. Same audience
   match + signature verification against Cloudflare Access JWKS. */
async function verifyJwt(token, env) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return { ok: false, reason: 'malformed' };
    const header = JSON.parse(b64uDecode(h));
    const payload = JSON.parse(b64uDecode(p));
    const audOk = Array.isArray(payload.aud) ? payload.aud.includes(env.CF_ACCESS_AUD) : payload.aud === env.CF_ACCESS_AUD;
    if (!audOk) return { ok: false, reason: 'aud mismatch' };
    if (payload.exp && payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    const jwksUrl = `https://${env.CF_ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const jwks = await (await fetch(jwksUrl, { cf: { cacheTtl: 600 } })).json();
    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) return { ok: false, reason: 'kid not found in JWKS' };
    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = Uint8Array.from(b64uDecode(s, true), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sig, data);
    if (!valid) return { ok: false, reason: 'signature invalid' };
    return { ok: true, email: payload.email || null };
  } catch (e) {
    return { ok: false, reason: 'parse error: ' + (e.message || e) };
  }
}

function b64uDecode(s, raw = false) {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - s.length % 4) % 4);
  return raw ? atob(norm) : new TextDecoder().decode(Uint8Array.from(atob(norm), c => c.charCodeAt(0)));
}

/* ═════════════════════════════════════════════════════════════════════════
   Audit log — shared with the rest of the admin hub
   (writes to ergsn-trade-docs.admin_audit_log via the AUDIT_DB binding)
   ═════════════════════════════════════════════════════════════════════════ */

async function audit(env, ctx, action, target_kind, target_id, ok_flag = 1, detail = null) {
  if (!env.AUDIT_DB) return;
  try {
    await env.AUDIT_DB.prepare(
      'INSERT INTO admin_audit_log (ts, actor_email, source, action, target_kind, target_id, ok, detail) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(
      new Date().toISOString(),
      ctx.email,
      ctx.source,
      action,
      target_kind,
      target_id,
      ok_flag,
      detail
    ).run();
  } catch (_) { /* never break the user action because audit failed */ }
}

/* ═════════════════════════════════════════════════════════════════════════
   Posts
   ═════════════════════════════════════════════════════════════════════════ */

async function listPosts(url, env, cors, _ctx) {
  const limit = clampInt(url.searchParams.get('limit'), 50, 200);
  const status = url.searchParams.get('status');
  let q = 'SELECT * FROM posts';
  const args = [];
  if (status) { q += ' WHERE status = ?'; args.push(status); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  args.push(limit);
  const r = await env.DB.prepare(q).bind(...args).all();
  return ok({ ok: true, rows: r.results || [] }, cors);
}

async function createPost(request, env, cors, ctx) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  if (!body.body || typeof body.body !== 'string') return fail(400, '`body` (string) required', cors);

  const id = 'p_' + randomId();
  const now = Date.now();
  const status = body.scheduled_at ? 'scheduled' : 'draft';

  await env.DB.prepare(
    'INSERT INTO posts (id, created_at, updated_at, scheduled_at, status, source, locale, body, hashtags, link, images_json, author_email, meta_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    id, now, now,
    body.scheduled_at || null,
    status,
    body.source === 'ai' ? 'ai' : 'user',
    body.locale || 'ko',
    body.body,
    JSON.stringify(body.hashtags || []),
    body.link || null,
    JSON.stringify(body.images || []),
    ctx.email,
    body.meta ? JSON.stringify(body.meta) : null
  ).run();

  /* Per-platform target rows: one per requested platform, status=pending. */
  const platforms = Array.isArray(body.platforms) ? body.platforms : [];
  for (const p of platforms) {
    await env.DB.prepare(
      'INSERT INTO post_targets (post_id, platform, account_label, status) VALUES (?,?,?,?)'
    ).bind(id, p, body.account_label || null, 'pending').run();
  }

  await audit(env, ctx, 'social.post.create', 'social_post', id, 1,
    JSON.stringify({ platforms, source: body.source || 'user', scheduled: !!body.scheduled_at }));

  return ok({ ok: true, id, status }, cors);
}

async function getPost(id, env, cors, _ctx) {
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return fail(404, 'not found', cors);
  const targets = await env.DB.prepare('SELECT * FROM post_targets WHERE post_id = ? ORDER BY id').bind(id).all();
  return ok({ ok: true, post, targets: targets.results || [] }, cors);
}

async function patchPost(id, request, env, cors, ctx) {
  const body = await safeJson(request);
  if (!body) return fail(400, 'invalid JSON', cors);
  /* Whitelist; never let the client force-flip status to 'published' or
     a foreign field. Status is owned by the publisher (Phase 2/3). */
  const colMap = {
    body: 'body', link: 'link', locale: 'locale',
    hashtags: 'hashtags', images: 'images_json',
    scheduled_at: 'scheduled_at'
  };
  const sets = [];
  const args = [];
  for (const k of Object.keys(colMap)) {
    if (k in body) {
      sets.push(colMap[k] + ' = ?');
      args.push(typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]);
    }
  }
  if (!sets.length) return fail(400, 'nothing to update', cors);
  sets.push('updated_at = ?'); args.push(Date.now());
  args.push(id);
  await env.DB.prepare('UPDATE posts SET ' + sets.join(', ') + ' WHERE id = ?').bind(...args).run();
  await audit(env, ctx, 'social.post.patch', 'social_post', id);
  return ok({ ok: true, id }, cors);
}

async function deletePost(id, env, cors, ctx) {
  await env.DB.prepare('DELETE FROM post_targets WHERE post_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  await audit(env, ctx, 'social.post.delete', 'social_post', id);
  return ok({ ok: true, id }, cors);
}

async function publishPostStub(id, env, cors, ctx) {
  /* Phase 1 stub: marks targets as 'skipped' (no OAuth yet) but still
     audits the intent so the trail is intact for Phase 2 flip. */
  const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(id).first();
  if (!post) return fail(404, 'not found', cors);
  await env.DB.prepare("UPDATE post_targets SET status = 'skipped', error = 'Phase 1 stub — OAuth not connected' WHERE post_id = ?").bind(id).run();
  await audit(env, ctx, 'social.post.publish_attempt', 'social_post', id, 0, 'phase 1 stub');
  return ok({ ok: true, stub: true, message: 'Phase 1 stub. Real fan-out arrives in Phase 2 (Meta) / Phase 3 (LinkedIn).' }, cors);
}

/* ═════════════════════════════════════════════════════════════════════════
   Image library
   ═════════════════════════════════════════════════════════════════════════ */

async function listImages(url, env, cors, _ctx) {
  const limit = clampInt(url.searchParams.get('limit'), 60, 200);
  const source = url.searchParams.get('source');
  let q = 'SELECT id, r2_key, filename, mime, width, height, size_bytes, alt_text, source, product_sku, uploaded_by, created_at FROM images';
  const args = [];
  if (source) { q += ' WHERE source = ?'; args.push(source); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  args.push(limit);
  const r = await env.DB.prepare(q).bind(...args).all();
  return ok({ ok: true, rows: r.results || [] }, cors);
}

async function uploadImage(request, env, cors, ctx) {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.startsWith('multipart/form-data')) return fail(400, 'multipart/form-data required', cors);
  const fd = await request.formData();
  const file = fd.get('file');
  if (!file || typeof file === 'string') return fail(400, '`file` field missing', cors);

  const id = 'img_' + randomId();
  const safeName = (file.name || 'img').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const ym = new Date().toISOString().slice(0, 7).replace('-', '/');
  const r2_key = `${ym}/${id}-${safeName}`;
  const alt = (fd.get('alt') || '').toString();

  await env.FILES.put(r2_key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });

  await env.DB.prepare(
    'INSERT INTO images (id, r2_key, filename, mime, size_bytes, alt_text, source, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(
    id, r2_key,
    file.name || null, file.type || null, file.size || null,
    alt || null, 'user',
    ctx.email, Date.now()
  ).run();

  await audit(env, ctx, 'social.image.upload', 'social_image', id, 1,
    JSON.stringify({ size: file.size, mime: file.type }));

  return ok({ ok: true, id, r2_key, mime: file.type, size: file.size }, cors);
}

async function serveImage(id, env, cors) {
  const row = await env.DB.prepare('SELECT r2_key, mime FROM images WHERE id = ?').bind(id).first();
  if (!row) return fail(404, 'not found', cors);
  const obj = await env.FILES.get(row.r2_key);
  if (!obj) return fail(404, 'binary missing', cors);
  return new Response(obj.body, {
    headers: { ...cors, 'Content-Type': row.mime || 'application/octet-stream', 'Cache-Control': 'private, max-age=300' }
  });
}

async function deleteImage(id, env, cors, ctx) {
  const row = await env.DB.prepare('SELECT r2_key FROM images WHERE id = ?').bind(id).first();
  if (!row) return fail(404, 'not found', cors);
  await env.FILES.delete(row.r2_key);
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
  await audit(env, ctx, 'social.image.delete', 'social_image', id);
  return ok({ ok: true, id }, cors);
}

/* ═════════════════════════════════════════════════════════════════════════
   OAuth status (Phase 2/3 fills in the rest)
   ═════════════════════════════════════════════════════════════════════════ */

async function listOauthStatus(env, cors) {
  const r = await env.DB.prepare(
    'SELECT provider, account_label, account_id, expires_at, scope, updated_at FROM oauth_tokens ORDER BY provider, account_label'
  ).all();
  return ok({ ok: true, connections: r.results || [] }, cors);
}

/* ═════════════════════════════════════════════════════════════════════════
   Templates (Phase 5 will add CRUD; Phase 1 just lists)
   ═════════════════════════════════════════════════════════════════════════ */

async function listTemplates(env, cors, _ctx) {
  const r = await env.DB.prepare('SELECT * FROM templates ORDER BY name').all();
  return ok({ ok: true, rows: r.results || [] }, cors);
}

/* ═════════════════════════════════════════════════════════════════════════
   helpers
   ═════════════════════════════════════════════════════════════════════════ */

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return null; }
}
function ok(obj, cors, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
}
function fail(status, error, cors) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
}
function stub(label, extra, cors) {
  return ok({ ok: true, stub: true, message: label, ...extra }, cors);
}
function clampInt(v, dflt, max) {
  const n = parseInt(v || dflt, 10) || dflt;
  return Math.min(Math.max(1, n), max);
}
function randomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}
