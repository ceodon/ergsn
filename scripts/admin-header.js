/* ERGSN Admin shared header — fixed top bar injected on every admin
   sub-tool page. One module wires:

     • ERGSN logo (links to /admin/)
     • Page title with breadcrumb (Hub › <PageTitle>)  — title comes from
       <meta name="admin-page-title" content="..."> on the host page,
       falling back to document.title.
     • Tools dropdown — quick-jumper to every admin tool with shortcut hints
     • Worker health pins — 4 small dots probing same-origin admin endpoints
     • Right-side identity: signed-in-as · sign out · main site
     • Last activity timestamp — pulled from admin_audit_log

   Companions auto-loaded so a sub-tool only needs one <script> tag:
     • /scripts/admin-footer.js
     • /scripts/top-fab.js
     • /scripts/admin-shortcuts.js
     • /scripts/admin-tokens.css (if not already linked)

   Note: chat.js (buyer-facing Trade Advisor) is intentionally NOT loaded
   on admin pages — it belongs to the public-site chrome. The maker/buyer
   review tools at maker.ergsn.net / buyer.ergsn.net keep chat as a
   convenience, but admin sub-tools (analytics / docs / mail / social) do
   not need a buyer chatbot.

   Self-injecting; bails if `#ehAdminTop` already exists. */
(function () {
  if (window.__ergsnAdminHeaderInjected) return;
  if (document.getElementById('ehAdminTop')) return;
  window.__ergsnAdminHeaderInjected = true;

  /* ─── Companion loaders ─────────────────────────────────────────── */
  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = src;
    document.head.appendChild(s);
  }
  function loadStyle(href) {
    if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  loadStyle('/scripts/admin-tokens.css');
  loadScript('/scripts/admin-footer.js');
  loadScript('/scripts/top-fab.js');
  loadScript('/scripts/admin-shortcuts.js');

  /* ─── Tool registry — used by dropdown + worker health probes ───── */
  var TOOLS = [
    { key: 'h', label: 'Hub',               href: '/admin/',                     section: 'Hub' },
    { key: 'a', label: 'Analytics',         href: '/admin-analytics.html',       section: 'Partners & Trade' },
    { key: 'p', label: 'Partner Dashboard', href: '/partner-dashboard.html',     section: 'Partners & Trade' },
    { key: 't', label: 'Trade Docs',        href: '/trade-docs.html',            section: 'Partners & Trade' },
    { key: 'm', label: 'Send Mail',         href: '/send-mail.html',             section: 'Comms' },
    { key: 's', label: 'Social Poster',     href: '/social.html',                section: 'Comms' },
    { key: 'r', label: 'Maker Review',      href: 'https://maker.ergsn.net/',    section: 'Review',  external: true },
    { key: 'b', label: 'Buyer Outreach',    href: 'https://buyer.ergsn.net/',    section: 'Review',  external: true }
  ];

  /* Probe URLs — pick the lightest GET endpoint each worker exposes. The
     mail worker rejects all non-POST with 405 (no GET routes by design),
     so we probe its `/health` which is added in cloudflare-worker-mail.js
     after a `wrangler deploy --config wrangler.mail.jsonc`. Even before
     that deploy lands, the new classifier below treats 405 as "up" — the
     worker IS responding, just to a method it doesn't route. */
  var WORKERS = [
    { name: 'docs',   probe: '/api/trade-docs/health' },
    { name: 'rfq',    probe: '/api/rfq/admin/item-metrics?range=1' },
    { name: 'mail',   probe: '/api/mail/health' },
    { name: 'social', probe: '/api/social/health' }
  ];

  /* ─── CSS ───────────────────────────────────────────────────────── */
  var CSS = [
    /* Reserve 56px at the top so the fixed bar never covers content.
       !important defeats per-page `body { padding: 0 }` shorthand resets
       (admin/index.html and several sub-tools ship that line). */
    'body{padding-top:56px !important}',
    '#ehAdminTop{position:fixed;top:0;left:0;right:0;z-index:900;height:56px;background:linear-gradient(180deg,#1a1f26,#111418);border-bottom:1px solid rgba(255,255,255,.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#e8e8e8}',
    '#ehAdminTop *{box-sizing:border-box}',
    '#ehAdminTop .eh-inner{height:100%;max-width:none;margin:0;padding:0 clamp(12px,2vw,22px);display:flex;align-items:center;gap:14px}',
    /* Logo */
    '#ehAdminTop .eh-logo{flex:0 0 auto;text-decoration:none;display:flex;align-items:center;gap:10px}',
    '#ehAdminTop .eh-logo-mark{font-size:20px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;line-height:1;background:linear-gradient(320deg,#a8a8a6 15%,#c2c0c0 48%,#f9f8f6 64%,#d4d4d4 76%,#7f7f7f 88%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-kerning:none;font-feature-settings:"kern" 0;-webkit-font-feature-settings:"kern" 0}',
    '#ehAdminTop .eh-logo-mark .eh-e{background:linear-gradient(84deg,#00bf79 42%,#00ffa1 81%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    /* Tools dropdown trigger */
    '#ehAdminTop .eh-tools{position:relative;flex:0 0 auto}',
    '#ehAdminTop .eh-tools-btn{background:rgba(255,255,255,.06);color:#ccc;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:6px 12px;font:600 12px/1 inherit;cursor:pointer;display:flex;align-items:center;gap:6px;transition:border-color .12s,color .12s}',
    '#ehAdminTop .eh-tools-btn:hover,#ehAdminTop .eh-tools-btn[aria-expanded="true"]{border-color:#34d298;color:#fff}',
    '#ehAdminTop .eh-tools-btn::after{content:"\\25BE";font-size:9px;opacity:.7}',
    '#ehAdminTop .eh-tools-menu{position:absolute;top:calc(100% + 8px);left:0;background:#181c22;border:1px solid rgba(255,255,255,.12);border-radius:10px;min-width:280px;padding:6px;box-shadow:0 20px 40px rgba(0,0,0,.5);display:none;z-index:950}',
    '#ehAdminTop .eh-tools.eh-open .eh-tools-menu{display:block}',
    '#ehAdminTop .eh-tools-section{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);padding:8px 12px 4px;font-weight:700}',
    '#ehAdminTop .eh-tools-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border-radius:6px;color:#fff;text-decoration:none;font-size:13px;transition:background .12s}',
    '#ehAdminTop .eh-tools-link:hover{background:rgba(52,210,152,.1);color:#fff;text-decoration:none}',
    '#ehAdminTop .eh-tools-link.eh-active{background:rgba(52,210,152,.15);color:#34d298}',
    '#ehAdminTop .eh-tools-shortcut{font-family:Consolas,Menlo,monospace;font-size:10px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);padding:1px 6px;border-radius:3px;letter-spacing:.04em}',
    /* Title / breadcrumb */
    '#ehAdminTop .eh-title{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(255,255,255,.85);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
    '#ehAdminTop .eh-title .eh-crumb{color:rgba(255,255,255,.4);font-size:12px}',
    '#ehAdminTop .eh-title .eh-crumb-sep{color:rgba(255,255,255,.25);margin:0 2px}',
    '#ehAdminTop .eh-title .eh-page{color:#fff;font-weight:600}',
    /* Worker health pins */
    '#ehAdminTop .eh-workers{display:flex;gap:8px;flex:0 0 auto;align-items:center;margin-right:6px}',
    '#ehAdminTop .eh-w-dot{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em}',
    '#ehAdminTop .eh-w-dot::before{content:"";width:7px;height:7px;border-radius:50%;background:#444;transition:background .25s}',
    '#ehAdminTop .eh-w-dot[data-state="up"]::before{background:#34d298}',
    '#ehAdminTop .eh-w-dot[data-state="warn"]::before{background:#ffc97a}',
    '#ehAdminTop .eh-w-dot[data-state="down"]::before{background:#ff7a7a;box-shadow:0 0 8px rgba(255,122,122,.5)}',
    '@media (max-width:920px){#ehAdminTop .eh-workers{display:none}}',
    /* Identity / right cluster */
    '#ehAdminTop .eh-id{flex:0 0 auto;display:flex;align-items:center;gap:10px;font-size:11px;color:rgba(255,255,255,.55)}',
    '#ehAdminTop .eh-id code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px;font-size:10.5px;color:#ccc;font-family:Consolas,Menlo,monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}',
    '#ehAdminTop .eh-id a{color:#34d298;text-decoration:none;font-size:11px}',
    '#ehAdminTop .eh-id a:hover{color:#00ffa1;text-decoration:underline}',
    '#ehAdminTop .eh-last{font-size:10px;color:rgba(255,255,255,.4);font-family:Consolas,Menlo,monospace}',
    '@media (max-width:760px){#ehAdminTop .eh-id .eh-id-via,#ehAdminTop .eh-last,#ehAdminTop .eh-title .eh-crumb{display:none}}',
    '@media print{#ehAdminTop{display:none !important}body{padding-top:0 !important}}'
  ].join('');

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pageTitle() {
    var m = document.querySelector('meta[name="admin-page-title"]');
    if (m && m.content) return m.content;
    return document.title.replace(/\s*·.*$/, '').replace(/\s*—.*$/, '');
  }

  function isCurrent(href) {
    var here = location.pathname.replace(/\/+$/, '/') || '/';
    var path = href.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '/') || '/';
    if (path === '/admin/' && (here === '/admin/' || here === '/admin/index.html')) return true;
    return here === path || here === path.replace(/\.html$/, '');
  }

  /* ─── Markup builder ────────────────────────────────────────────── */
  function buildMarkup() {
    var title = pageTitle();
    var isHub = isCurrent('/admin/');

    var crumb = isHub
      ? '<span class="eh-page">Admin Hub</span>'
      : '<a class="eh-crumb" href="/admin/">Hub</a><span class="eh-crumb-sep">›</span><span class="eh-page">' + escapeHTML(title) + '</span>';

    var sections = {};
    TOOLS.forEach(function (t) {
      if (!sections[t.section]) sections[t.section] = [];
      sections[t.section].push(t);
    });
    var sectionsHtml = Object.keys(sections).map(function (sec) {
      return '<div class="eh-tools-section">' + escapeHTML(sec) + '</div>' +
        sections[sec].map(function (t) {
          var active = isCurrent(t.href) ? ' eh-active' : '';
          var ext = t.external ? ' target="_blank" rel="noopener"' : '';
          return '<a class="eh-tools-link' + active + '" href="' + escapeHTML(t.href) + '"' + ext + '>' +
            '<span>' + escapeHTML(t.label) + (t.external ? ' ↗' : '') + '</span>' +
            '<span class="eh-tools-shortcut">g ' + escapeHTML(t.key) + '</span>' +
          '</a>';
        }).join('');
    }).join('');

    var workers = WORKERS.map(function (w) {
      return '<span class="eh-w-dot" data-w="' + escapeHTML(w.name) + '" title="' + escapeHTML(w.probe) + '">' + escapeHTML(w.name) + '</span>';
    }).join('');

    return (
      '<header id="ehAdminTop" role="banner">' +
        '<div class="eh-inner">' +
          '<a class="eh-logo" href="/admin/" aria-label="Admin Hub">' +
            '<span class="eh-logo-mark"><span class="eh-e">E</span>RGSN</span>' +
          '</a>' +

          '<div class="eh-tools" id="ehTools">' +
            '<button class="eh-tools-btn" type="button" aria-haspopup="menu" aria-expanded="false">Tools</button>' +
            '<div class="eh-tools-menu" role="menu">' + sectionsHtml + '</div>' +
          '</div>' +

          '<div class="eh-title">' + crumb + '</div>' +

          '<div class="eh-workers" aria-label="Worker health">' + workers + '</div>' +

          '<div class="eh-id">' +
            '<span class="eh-last" id="ehLastActivity"></span>' +
            '<span class="eh-id-via">Signed in <code id="ehWho">…</code></span>' +
            '<a id="ehLogout" href="#" target="_top">sign out</a>' +
            '<a href="https://ergsn.net/" target="_blank" rel="noopener">site ↗</a>' +
          '</div>' +
        '</div>' +
      '</header>'
    );
  }

  /* ─── Behavior wiring ──────────────────────────────────────────── */
  var CF_ACCESS_TEAM = 'ergsn';

  async function loadWho() {
    var el = document.getElementById('ehWho');
    if (!el) return;
    try {
      var r = await fetch('/cdn-cgi/access/get-identity', { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401 || r.status === 403) { el.textContent = 'no CF Access'; el.title = 'open admin.ergsn.net for the gated path'; return; }
      if (!r.ok) { el.textContent = 'HTTP ' + r.status; return; }
      var d = await r.json();
      el.textContent = d.email || d.user_uuid || 'authenticated';
      el.title = 'idp=' + (d.idp && d.idp.type || 'unknown') + ' · iat=' + (d.iat || '?');
    } catch (e) {
      el.textContent = 'offline';
      el.title = e && e.message || '';
    }
  }

  async function loadLastActivity() {
    var el = document.getElementById('ehLastActivity');
    if (!el) return;
    try {
      var r = await fetch('/api/trade-docs/admin/audit/recent?limit=1', {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!r.ok) return;
      var d = await r.json();
      var row = d && d.rows && d.rows[0];
      if (!row || !row.ts) return;
      el.textContent = '· ' + relTime(row.ts) + ' ago';
      el.title = (row.actor_email || row.source || 'system') + ' · ' + (row.action || '') + ' · ' + row.ts;
    } catch (_) {}
  }

  function relTime(ts) {
    var t = Date.parse(ts);
    if (!t) return '';
    var diff = (Date.now() - t) / 1000;
    if (diff < 60) return Math.floor(diff) + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }

  async function probeWorker(w) {
    var dot = document.querySelector('#ehAdminTop .eh-w-dot[data-w="' + w.name + '"]');
    if (!dot) return;
    try {
      var r = await fetch(w.probe, { credentials: 'include', cache: 'no-store', method: 'GET' });
      /* Health classification — pin reflects worker liveness, not endpoint
         correctness. Any 2xx/4xx response means the worker received the
         request and answered (it's alive). Only 5xx or a network error
         counts as down. 401/403 specifically surface as warn so an auth
         drop is visible without being mistaken for a worker outage. */
      if (r.ok) dot.dataset.state = 'up';
      else if (r.status === 401 || r.status === 403) dot.dataset.state = 'warn';
      else if (r.status >= 500) dot.dataset.state = 'down';
      else dot.dataset.state = 'up';
    } catch (_) {
      dot.dataset.state = 'down';
    }
  }

  function probeAll() { WORKERS.forEach(probeWorker); }

  function wireDropdown() {
    var wrap = document.getElementById('ehTools');
    if (!wrap) return;
    var btn = wrap.querySelector('.eh-tools-btn');
    function close() { wrap.classList.remove('eh-open'); btn.setAttribute('aria-expanded', 'false'); }
    function open()  { wrap.classList.add('eh-open');    btn.setAttribute('aria-expanded', 'true'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (wrap.classList.contains('eh-open')) close(); else open();
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  function wireLogout() {
    var a = document.getElementById('ehLogout');
    if (!a) return;
    a.href = 'https://' + CF_ACCESS_TEAM + '.cloudflareaccess.com/cdn-cgi/access/logout';
  }

  function inject() {
    if (!document.body) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var w = document.createElement('div');
    w.innerHTML = buildMarkup();
    while (w.firstChild) document.body.insertBefore(w.firstChild, document.body.firstChild);

    wireDropdown();
    wireLogout();
    loadWho();
    loadLastActivity();
    probeAll();
    setInterval(probeAll, 60000);
    setInterval(loadLastActivity, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
