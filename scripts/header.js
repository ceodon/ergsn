/* ERGSN shared header — sticky top bar for standalone pages.
   Logo (top-left, links to index.html) · language selector + hamburger (top-right).
   The hamburger opens a slide-down menu that mirrors the four groups of
   index.html's nav (Shop / For Buyers / Trust / Connect), with all anchors
   resolved against index.html so the links work from anywhere.

   Design notes:
   - Self-injecting. Add `<script defer src="scripts/header.js"></script>` to
     any page and the bar + menu appear automatically.
   - Bails out if the page already has the full index nav (`#nav`) so the
     homepage isn't double-headed.
   - Uses scoped `.eh-*` class names to avoid colliding with page CSS.
   - No user input is interpolated into markup — all copy is static strings,
     so `innerHTML` is safe.
   - Language selection on standalone pages writes `ergsn_lang` to localStorage
     and navigates to `index.html`, where the existing `initLang` bootstrap
     applies the translation. Standalone pages themselves are not translated.
   - `@media print` hides the bar so PDF exports (spec sheets, invoices,
     certificates) stay clean. */
(function () {
  if (window.__ergsnHeaderInjected) return;
  window.__ergsnHeaderInjected = true;
  if (document.getElementById('nav')) return;

  var CSS = [
    '.eh-bar{position:sticky;top:0;left:0;right:0;z-index:950;height:56px;background:#0a0a0a;border-bottom:1px solid #1c1c1c;box-shadow:0 1px 0 rgba(52,210,152,.12);font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.eh-inner{max-width:1240px;margin:0 auto;height:100%;padding:0 clamp(14px,3vw,28px);display:flex;align-items:center;justify-content:space-between;gap:14px}',
    '.eh-logo{display:inline-flex;align-items:center;text-decoration:none;flex-shrink:0}',
    '.eh-logo-mark{font-family:Syncopate,"DM Serif Display",system-ui,sans-serif;font-size:clamp(17px,2vw,20px);font-weight:800;letter-spacing:.16em;color:#fff;line-height:1;position:relative;padding-bottom:4px}',
    '.eh-logo-mark::after{content:"";position:absolute;bottom:0;left:0;right:0;height:1.5px;background:linear-gradient(90deg,#34d298 0%,rgba(52,210,152,.2) 100%)}',
    '.eh-logo-mark .eh-e{color:#34d298}',
    '.eh-right{display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '.eh-lang{font-family:inherit;font-size:12px;font-weight:600;letter-spacing:.06em;color:#cfcfcf;background:#141414;border:1px solid #2a2a2a;border-radius:7px;padding:6px 10px;outline:none;cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:linear-gradient(45deg,transparent 50%,#8a8b8d 50%),linear-gradient(135deg,#8a8b8d 50%,transparent 50%);background-position:calc(100% - 14px) 50%,calc(100% - 10px) 50%;background-size:4px 4px;background-repeat:no-repeat;padding-right:24px}',
    '.eh-lang:hover{border-color:#34d298;color:#fff}',
    '.eh-lang:focus{border-color:#34d298}',
    '.eh-ham{width:36px;height:36px;padding:8px 7px;display:flex;flex-direction:column;justify-content:space-between;background:transparent;border:1px solid #2a2a2a;border-radius:7px;cursor:pointer}',
    '.eh-ham span{display:block;height:2px;width:100%;background:#fff;border-radius:1px;transition:transform .2s,opacity .2s}',
    '.eh-ham:hover{border-color:#34d298}',
    '.eh-ham.eh-open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}',
    '.eh-ham.eh-open span:nth-child(2){opacity:0}',
    '.eh-ham.eh-open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}',
    '.eh-menu{position:fixed;top:56px;left:0;right:0;max-height:calc(100vh - 56px);overflow-y:auto;background:#0f0f0f;border-bottom:1px solid #1c1c1c;padding:14px clamp(14px,3vw,28px) 22px;z-index:949;transform:translateY(-8px);opacity:0;visibility:hidden;transition:opacity .18s,transform .2s,visibility 0s linear .2s}',
    '.eh-menu.eh-open{transform:translateY(0);opacity:1;visibility:visible;transition:opacity .2s,transform .22s,visibility 0s}',
    '.eh-menu-inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}',
    '@media (max-width:820px){.eh-menu-inner{grid-template-columns:repeat(2,1fr);gap:18px}}',
    '@media (max-width:480px){.eh-menu-inner{grid-template-columns:1fr;gap:12px}}',
    '.eh-col-title{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#34d298;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(52,210,152,.18)}',
    '.eh-list{list-style:none;margin:0;padding:0}',
    '.eh-list li{margin:0}',
    '.eh-list a{display:block;padding:7px 0;font-size:13px;font-weight:500;color:#cfcfcf;text-decoration:none;border-bottom:1px dashed rgba(255,255,255,.04);transition:color .15s}',
    '.eh-list a:hover{color:#34d298}',
    '.eh-list a .eh-tag{display:inline-block;margin-left:6px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:4px;background:rgba(52,210,152,.14);color:#34d298;vertical-align:1px}',
    '.eh-list a .eh-tag.eh-tag-soon{background:rgba(255,255,255,.06);color:#8a8b8d}',
    '.eh-cta{display:inline-flex;align-items:center;margin-top:14px;padding:10px 18px;background:#34d298;color:#0a0a0a;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;border-radius:7px;text-decoration:none}',
    '.eh-cta:hover{background:#00ffa1}',
    '@media print{.eh-bar,.eh-menu{display:none !important}}'
  ].join('');

  var MENU_COLS = [
    {
      title: 'Shop',
      items: [
        { href: 'index.html#products', label: 'K-Security',     tag: 'Active' },
        { href: 'index.html#products', label: 'K-Tech',         tag: 'Active' },
        { href: 'index.html#products', label: 'K-Energy',       tag: 'Active' },
        { href: 'index.html#products', label: 'K-Bio',          tag: 'Active' },
        { href: 'index.html#products', label: 'K-Beauty',       tag: 'Soon' },
        { href: 'index.html#products', label: 'K-Culture Goods',tag: 'Soon' },
        { href: 'index.html#products', label: 'K-Franchise',    tag: 'Soon' },
        { href: 'index.html#products', label: 'K-Smart Living', tag: 'Soon' },
        { href: 'index.html#match',    label: 'AI Partner Match' },
        { href: 'index.html#calculator', label: 'Quote Calculator' },
        { href: 'export-docs.html',    label: 'Export Documents AI' }
      ]
    },
    {
      title: 'For Buyers',
      items: [
        { href: 'index.html#wanted', label: 'Wanted Board' },
        { href: 'index.html#trend',  label: 'Trend Monthly' },
        { href: 'buyers-healthcare.html',  label: 'Healthcare Procurement' },
        { href: 'buyers-government.html',  label: 'Government Procurement' },
        { href: 'buyers-hospitality.html', label: 'Hospitality & Retail' }
      ]
    },
    {
      title: 'Trust',
      items: [
        { href: 'index.html#about',   label: 'About ERGSN' },
        { href: 'index.html#cases',   label: 'Case Studies' },
        { href: 'index.html#verify',  label: 'Verification Process' },
        { href: 'verified-partner.html', label: 'Verified Partner Program' },
        { href: 'escrow.html',           label: 'Escrow Service' },
        { href: 'index.html#map',       label: 'Trade Route Map' },
        { href: 'index.html#compliance',label: 'Compliance' },
        { href: 'index.html#qa',        label: 'Q&A Wall' }
      ]
    },
    {
      title: 'Connect',
      items: [
        { href: 'index.html#rfq',    label: 'Request a Quote' },
        { href: 'index.html#tools',  label: 'Book a Demo' },
        { href: 'trade-mission.html', label: 'Trade Mission Live' },
        { href: 'tracker.html',       label: 'RFQ Tracker' },
        { href: 'partners-kr.html',   label: 'KR · 파트너 문의' }
      ]
    }
  ];

  function buildMenuMarkup() {
    var colsHtml = MENU_COLS.map(function (col) {
      var itemsHtml = col.items.map(function (it) {
        var tagHtml = '';
        if (it.tag) {
          var cls = it.tag === 'Soon' ? 'eh-tag eh-tag-soon' : 'eh-tag';
          tagHtml = ' <span class="' + cls + '">' + it.tag + '</span>';
        }
        return '<li><a href="' + it.href + '">' + it.label + tagHtml + '</a></li>';
      }).join('');
      return (
        '<div>' +
        '<h3 class="eh-col-title">' + col.title + '</h3>' +
        '<ul class="eh-list">' + itemsHtml + '</ul>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="eh-menu" id="ehMenu" aria-hidden="true" role="region" aria-label="Site navigation">' +
      '<div class="eh-menu-inner">' + colsHtml + '</div>' +
      '<a href="index.html#rfq" class="eh-cta">Request a Quote &rarr;</a>' +
      '</div>'
    );
  }

  var HEADER_MARKUP = (
    '<header class="eh-bar" role="banner">' +
    '<div class="eh-inner">' +
    '<a href="index.html" class="eh-logo" aria-label="ERGSN home">' +
    '<span class="eh-logo-mark"><span class="eh-e">E</span>RGSN</span>' +
    '</a>' +
    '<div class="eh-right">' +
    '<select class="eh-lang" aria-label="Language">' +
    '<option value="en">EN</option>' +
    '<option value="es">ES</option>' +
    '<option value="ar">عربي</option>' +
    '<option value="fr">FR</option>' +
    '<option value="ja">日本語</option>' +
    '<option value="tr">TR</option>' +
    '<option value="zh-Hans">简体</option>' +
    '<option value="zh-Hant">繁體</option>' +
    '</select>' +
    '<button type="button" class="eh-ham" aria-label="Menu" aria-expanded="false" aria-controls="ehMenu">' +
    '<span></span><span></span><span></span>' +
    '</button>' +
    '</div>' +
    '</div>' +
    '</header>'
  );

  function inject() {
    if (!document.body) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = HEADER_MARKUP + buildMenuMarkup();
    var nodes = Array.prototype.slice.call(wrapper.children);
    for (var i = nodes.length - 1; i >= 0; i--) {
      document.body.insertBefore(nodes[i], document.body.firstChild);
    }

    var ham = document.querySelector('.eh-bar .eh-ham');
    var menu = document.getElementById('ehMenu');
    if (ham && menu) {
      ham.addEventListener('click', function () {
        var nowOpen = !menu.classList.contains('eh-open');
        menu.classList.toggle('eh-open', nowOpen);
        ham.classList.toggle('eh-open', nowOpen);
        ham.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        menu.setAttribute('aria-hidden', nowOpen ? 'false' : 'true');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('eh-open')) ham.click();
      });
    }

    var lang = document.querySelector('.eh-bar .eh-lang');
    if (lang) {
      try {
        var saved = localStorage.getItem('ergsn_lang');
        if (saved) {
          for (var j = 0; j < lang.options.length; j++) {
            if (lang.options[j].value === saved) { lang.value = saved; break; }
          }
        }
      } catch (_) {}
      lang.addEventListener('change', function () {
        var target = lang.value;
        try { localStorage.setItem('ergsn_lang', target); } catch (_) {}
        if (typeof window.setLang === 'function') { window.setLang(target); return; }
        window.location.href = 'index.html';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
