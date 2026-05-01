/* ERGSN Admin shared footer — arch note + external services status row +
   help links. Self-injecting; bails if `#ehAdminFooter` already exists. */
(function () {
  if (window.__ergsnAdminFooterInjected) return;
  if (document.getElementById('ehAdminFooter')) return;
  window.__ergsnAdminFooterInjected = true;

  /* External services we touch — order mirrors the strip the user sees.
     `probe` is the same-origin endpoint we GET to assess health.
     `ok` is the HTTP code we treat as healthy (any 2xx by default). */
  var SERVICES = [
    { name: 'CF Access',  probe: '/cdn-cgi/access/get-identity', expect: [200, 401] }, /* 401 = no session, but service is up */
    { name: 'Trade Docs', probe: '/api/trade-docs/admin/audit/recent?limit=1' },
    { name: 'RFQ',        probe: '/api/rfq/admin/item-metrics?days=1' },
    { name: 'Mail',       probe: '/api/mail/admin/health' },
    { name: 'Social',     probe: '/api/social/posts?limit=1' }
  ];

  var CSS = [
    '#ehAdminFooter{margin:48px auto 0;max-width:1180px;padding:24px clamp(16px,4vw,32px) 36px;border-top:1px solid rgba(255,255,255,.08);font:11px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans KR",sans-serif;color:rgba(255,255,255,.55)}',
    '#ehAdminFooter .eh-arch{margin:0 0 12px}',
    '#ehAdminFooter code{background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;font-size:10px;color:#cccccc;font-family:Consolas,Menlo,monospace}',
    '#ehAdminFooter .eh-svc{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:8px 0 14px;padding:8px 0;border-top:1px dashed rgba(255,255,255,.06);border-bottom:1px dashed rgba(255,255,255,.06)}',
    '#ehAdminFooter .eh-svc-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-right:4px}',
    '#ehAdminFooter .eh-svc-item{display:inline-flex;align-items:center;gap:6px;font-size:11px}',
    '#ehAdminFooter .eh-svc-dot{width:8px;height:8px;border-radius:50%;background:#444;flex:0 0 auto;transition:background .25s}',
    '#ehAdminFooter .eh-svc-dot.eh-up{background:#34d298}',
    '#ehAdminFooter .eh-svc-dot.eh-down{background:#ff7a7a}',
    '#ehAdminFooter .eh-svc-dot.eh-warn{background:#ffc97a}',
    '#ehAdminFooter .eh-help{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px}',
    '#ehAdminFooter .eh-help a{color:#34d298;text-decoration:none;font-size:11px}',
    '#ehAdminFooter .eh-help a:hover{color:#00ffa1;text-decoration:underline}',
    '@media print{#ehAdminFooter{display:none !important}}'
  ].join('');

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var MARKUP = (
    '<footer id="ehAdminFooter" role="contentinfo">' +
      '<p class="eh-arch">' +
        'Architecture · auth via <code>Cloudflare Access</code> (Phase 0-1) · audit via <code>D1 admin_audit_log</code> on <code>ergsn-trade-docs</code> (Phase 4) · token-based fallback intentionally retained as recovery path.' +
      '</p>' +
      '<div class="eh-svc">' +
        '<span class="eh-svc-label">Services</span>' +
        SERVICES.map(function (s, i) {
          return '<span class="eh-svc-item" data-svc="' + i + '" title="' + escapeHTML(s.probe) + '">' +
            '<span class="eh-svc-dot"></span>' + escapeHTML(s.name) +
          '</span>';
        }).join('') +
      '</div>' +
      '<div class="eh-help">' +
        '<a href="/admin/" target="_top">Hub</a>' +
        '<a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">CF Dashboard ↗</a>' +
        '<a href="https://resend.com/emails" target="_blank" rel="noopener">Resend ↗</a>' +
        '<a href="https://console.anthropic.com/" target="_blank" rel="noopener">Anthropic ↗</a>' +
        '<a href="https://app.tavily.com/" target="_blank" rel="noopener">Tavily ↗</a>' +
        '<span style="margin-left:auto;color:rgba(255,255,255,.35)">Plan: <code>memory/project_admin_dashboard_plan.md</code> · Runbook: <code>admin/CF_ACCESS_SETUP.md</code></span>' +
      '</div>' +
    '</footer>'
  );

  async function probeService(item, dot) {
    try {
      var r = await fetch(item.probe, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Accept': 'application/json,text/plain,*/*' }
      });
      var expect = item.expect || [];
      if (expect.indexOf(r.status) >= 0) { dot.classList.add('eh-up'); return; }
      if (r.status >= 200 && r.status < 300) { dot.classList.add('eh-up'); return; }
      if (r.status === 401 || r.status === 403) { dot.classList.add('eh-warn'); return; }
      dot.classList.add('eh-down');
    } catch (_) {
      dot.classList.add('eh-down');
    }
  }

  function inject() {
    if (!document.body) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var w = document.createElement('div');
    w.innerHTML = MARKUP;
    while (w.firstChild) document.body.appendChild(w.firstChild);

    var dots = document.querySelectorAll('#ehAdminFooter .eh-svc-item');
    SERVICES.forEach(function (s, i) {
      var dot = dots[i] && dots[i].querySelector('.eh-svc-dot');
      if (dot) probeService(s, dot);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
