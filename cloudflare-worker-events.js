/**
 * ERGSN Live Events — Cloudflare Worker + KV (for real-time activity ticker)
 *
 * Deployment (5 minutes, optional):
 * 1. Cloudflare → Workers & Pages → KV → Create namespace: ergsn-events
 * 2. Create Worker: ergsn-events
 * 3. Paste this file, Save and Deploy
 * 4. Settings → Bindings → Add → KV Namespace:
 *      Variable name: EVENTS
 *      KV namespace:  ergsn-events
 *    Settings → Variables & Secrets:
 *      ALLOW_ORIGIN = https://ceodon.github.io
 * 5. In index.html, set EVENTS_URL = the Worker URL.
 *
 * Routes:
 *   POST /log    body: { kind, country, detail }  → logs an anonymous event
 *   GET  /recent                                  → returns last 15 events
 */
const MAX_EVENTS = 50;
const KEY = 'ticker';

function cors(origin, allow) {
  const ok = allow === '*' || origin === allow;
  return {
    'Access-Control-Allow-Origin': ok ? (allow === '*' ? '*' : allow) : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOW_ORIGIN || '*';
    const headers = cors(origin, allow);
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    if (!env.EVENTS || typeof env.EVENTS.get !== 'function') {
      return new Response(JSON.stringify({ ok: false, error: 'KV namespace EVENTS is not bound.' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    if (request.method === 'POST' && path.endsWith('/log')) {
      if (allow !== '*' && origin !== allow) {
        return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers }); }
      const kind = String(body.kind || 'visit').slice(0, 24);
      const country = String(body.country || '').slice(0, 64);
      const detail = String(body.detail || '').slice(0, 140);
      const raw = await env.EVENTS.get(KEY);
      let list = [];
      try { list = raw ? JSON.parse(raw) : []; if (!Array.isArray(list)) list = []; } catch { list = []; }
      list.unshift({ kind, country, detail, t: Date.now() });
      list = list.slice(0, MAX_EVENTS);
      await env.EVENTS.put(KEY, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 30 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'GET' && path.endsWith('/recent')) {
      const raw = await env.EVENTS.get(KEY);
      let list = [];
      try { list = raw ? JSON.parse(raw) : []; if (!Array.isArray(list)) list = []; } catch { list = []; }
      return new Response(JSON.stringify({ ok: true, events: list.slice(0, 15) }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
