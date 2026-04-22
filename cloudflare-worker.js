/**
 * ERGSN Telegram Proxy — Cloudflare Worker
 *
 * Deployment (one-time, 5 minutes):
 * 1. Sign up at https://dash.cloudflare.com (free)
 * 2. Workers & Pages → Create Worker → paste this file
 * 3. Settings → Variables → add secrets (all values are SECRETS — never commit real values):
 *      TG_BOT       = <telegram-bot-token from @BotFather>
 *      TG_CHAT      = <telegram-chat-id>
 *      ALLOW_ORIGIN = https://ergsn.net,https://ceodon.github.io
 *                     (comma-separated list; during custom-domain migration
 *                      keep both values so users on either host can post)
 * 4. Deploy → copy the workers.dev URL (e.g. https://ergsn-tg.<sub>.workers.dev)
 * 5. In index.html set:   const TG_PROXY_URL = 'https://ergsn-tg.<sub>.workers.dev';
 *
 * Token rotation policy:
 *   - Never paste live tokens in this file or any committed code.
 *   - Store tokens only as Cloudflare Worker Secrets.
 *   - If a token has ever been committed (check git history), treat it as
 *     compromised: @BotFather → /revoke → issue new token → update the
 *     Cloudflare secret. The browser never sees the token either way.
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowRaw = env.ALLOW_ORIGIN || '*';
    const allowList = allowRaw.split(',').map(s => s.trim()).filter(Boolean);
    const wildcard = allowList.includes('*');
    const matched = wildcard ? '*' : (allowList.includes(origin) ? origin : '');
    const cors = {
      'Access-Control-Allow-Origin': matched,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!matched) {
      return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

    // Only allow photo URLs hosted on our own product image paths.
    // Prevents abuse of the worker as an image relay for arbitrary third-party content.
    // Kept as an array so the custom domain (ergsn.net) and the legacy
    // GitHub Pages URL (ceodon.github.io/ergsn) both work during migration.
    const PHOTO_ALLOW_PREFIXES = [
      'https://ergsn.net/images/',
      'https://ceodon.github.io/ergsn/images/'
    ];
    const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
    if (rawPhotos.some(u => typeof u !== 'string' || !PHOTO_ALLOW_PREFIXES.some(p => u.startsWith(p)))) {
      return new Response(JSON.stringify({ ok: false, error: 'photos must start with one of: ' + PHOTO_ALLOW_PREFIXES.join(', ') }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const photos = rawPhotos.slice(0, 10);
    const text = String(body.text || '').slice(0, 3800);

    let api, payload;
    if (photos.length > 1) {
      api = 'sendMediaGroup';
      const caption = String(body.caption || '').slice(0, 1000);
      const media = photos.map((u, i) => {
        const item = { type: 'photo', media: u };
        if (i === 0 && caption) {
          item.caption = caption;
          if (body.parse_mode === 'HTML' || body.parse_mode === 'Markdown' || body.parse_mode === 'MarkdownV2') item.parse_mode = body.parse_mode;
        }
        return item;
      });
      payload = { chat_id: env.TG_CHAT, media };
    } else if (photos.length === 1) {
      api = 'sendPhoto';
      payload = { chat_id: env.TG_CHAT, photo: photos[0] };
      const caption = String(body.caption || '').slice(0, 1000);
      if (caption) payload.caption = caption;
      if (body.parse_mode === 'HTML' || body.parse_mode === 'Markdown' || body.parse_mode === 'MarkdownV2') payload.parse_mode = body.parse_mode;
    } else {
      if (!text) return new Response('Empty', { status: 400, headers: cors });
      api = 'sendMessage';
      payload = { chat_id: env.TG_CHAT, text };
      if (body.parse_mode === 'HTML' || body.parse_mode === 'Markdown' || body.parse_mode === 'MarkdownV2') payload.parse_mode = body.parse_mode;
    }

    const tg = await fetch(`https://api.telegram.org/bot${env.TG_BOT}/${api}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const ok = tg.ok;
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 502,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};
