/**
 * ERGSN Telegram Proxy — Cloudflare Worker
 *
 * Deployment (one-time, 5 minutes):
 * 1. Sign up at https://dash.cloudflare.com (free)
 * 2. Workers & Pages → Create Worker → paste this file
 * 3. Settings → Variables → add secrets:
 *      TG_BOT     = 8682443200:AAHdCK-kkMDFuIZUvi4foAD3-ypNMRBGyGY
 *      TG_CHAT    = 456668222
 *      ALLOW_ORIGIN = https://ceodon.github.io
 * 4. Deploy → copy the workers.dev URL (e.g. https://ergsn-tg.<sub>.workers.dev)
 * 5. In index.html set:   const TG_PROXY_URL = 'https://ergsn-tg.<sub>.workers.dev';
 *
 * After deployment, rotate the original bot token (Telegram @BotFather → /revoke)
 * and replace TG_BOT in the Cloudflare secret with the new token.
 *
 * The bot token never ships to the browser again.
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow === '*' ? '*' : (origin === allow ? allow : ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (allow !== '*' && origin !== allow) {
      return new Response(JSON.stringify({ ok: false, error: 'origin not allowed' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

    const photos = Array.isArray(body.photos) ? body.photos.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 10) : [];
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
