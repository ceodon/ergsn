/* ERGSN Admin keyboard shortcuts — vim-style g+<key> jumps between admin
   tools, ? opens a help overlay. Loaded as companion by admin-header.js.

   Bindings:
     g h  → /admin/                    (Hub)
     g a  → /admin-analytics.html      (Analytics)
     g p  → /partner-dashboard.html    (Partner Dashboard, public chrome)
     g t  → /trade-docs.html           (Trade Documentation)
     g m  → /send-mail.html            (Send Mail)
     g s  → /social.html               (Social Poster)
     g r  → https://maker.ergsn.net/   (Maker Review · tunnel)
     g b  → https://buyer.ergsn.net/   (Buyer Outreach · tunnel)
     ?    → toggle help overlay
     Esc  → close help overlay

   Shortcuts disable while typing in any input/textarea/contenteditable
   so they never collide with form entry. */
(function () {
  if (window.__ergsnAdminShortcutsInjected) return;
  window.__ergsnAdminShortcutsInjected = true;

  var BINDINGS = [
    { keys: 'g h', label: 'Admin Hub',         href: '/admin/' },
    { keys: 'g a', label: 'Analytics',         href: '/admin-analytics.html' },
    { keys: 'g p', label: 'Partner Dashboard', href: '/partner-dashboard.html' },
    { keys: 'g t', label: 'Trade Docs',        href: '/trade-docs.html' },
    { keys: 'g m', label: 'Send Mail',         href: '/send-mail.html' },
    { keys: 'g s', label: 'Social Poster',     href: '/social.html' },
    { keys: 'g r', label: 'Maker Review',      href: 'https://maker.ergsn.net/' },
    { keys: 'g b', label: 'Buyer Outreach',    href: 'https://buyer.ergsn.net/' }
  ];

  var CSS = [
    '#ehShortcutHelp{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:980;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px)}',
    '#ehShortcutHelp.eh-open{display:flex}',
    '#ehShortcutHelp .eh-card{background:#181c22;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:24px 28px;max-width:480px;width:90%;color:#e8e8e8;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans KR",sans-serif}',
    '#ehShortcutHelp h2{margin:0 0 14px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#34d298}',
    '#ehShortcutHelp table{width:100%;border-collapse:collapse}',
    '#ehShortcutHelp td{padding:6px 4px;font-size:13px;border-bottom:1px dashed rgba(255,255,255,.06)}',
    '#ehShortcutHelp td.k{font-family:Consolas,Menlo,monospace;color:#34d298;width:80px}',
    '#ehShortcutHelp .eh-foot{margin-top:14px;font-size:11px;color:rgba(255,255,255,.5)}',
    '#ehShortcutHelp .eh-foot kbd{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-family:Consolas,Menlo,monospace;font-size:10px;border:1px solid rgba(255,255,255,.12)}',
    '@media print{#ehShortcutHelp{display:none !important}}'
  ].join('');

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var HELP_HTML = (
    '<div class="eh-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">' +
      '<h2>Keyboard shortcuts</h2>' +
      '<table>' +
        BINDINGS.map(function (b) {
          return '<tr><td class="k">' + escapeHTML(b.keys) + '</td><td>' + escapeHTML(b.label) + '</td></tr>';
        }).join('') +
        '<tr><td class="k">?</td><td>Toggle this help</td></tr>' +
        '<tr><td class="k">Esc</td><td>Close menus / overlays</td></tr>' +
      '</table>' +
      '<div class="eh-foot">Press <kbd>g</kbd> then a target letter within 1.2 s. Disabled while typing.</div>' +
    '</div>'
  );

  function isTyping(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function inject() {
    if (!document.body) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var ov = document.createElement('div');
    ov.id = 'ehShortcutHelp';
    ov.innerHTML = HELP_HTML;
    document.body.appendChild(ov);

    function closeHelp() { ov.classList.remove('eh-open'); }
    function toggleHelp() { ov.classList.toggle('eh-open'); }
    ov.addEventListener('click', function (e) { if (e.target === ov) closeHelp(); });

    var pendingG = false;
    var gTimer = null;
    var GMAP = BINDINGS.reduce(function (m, b) {
      m[b.keys.split(' ')[1]] = b.href;
      return m;
    }, {});

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === 'Escape') { closeHelp(); return; }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); toggleHelp(); return; }

      if (pendingG) {
        var dest = GMAP[e.key.toLowerCase()];
        pendingG = false;
        if (gTimer) { clearTimeout(gTimer); gTimer = null; }
        if (dest) {
          e.preventDefault();
          if (dest.indexOf('http') === 0) window.open(dest, '_blank', 'noopener');
          else location.href = dest;
        }
        return;
      }

      if (e.key === 'g' && !e.shiftKey) {
        pendingG = true;
        gTimer = setTimeout(function () { pendingG = false; }, 1200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
