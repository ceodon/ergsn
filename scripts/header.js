/* ERGSN shared header — full parity with index.html's nav, injected into
   every standalone page.

   Desktop (>680px): horizontal nav with four hover dropdowns (Shop / For
   Buyers / Trust / Connect), Request Quote CTA, and language selector.
   Mobile (<=680px): logo + hamburger; tapping opens a slide-down panel
   that mirrors index.html's <details>-style mobile menu exactly.

   Design notes:
   - Self-injecting. Add `<script defer src="scripts/header.js"></script>`
     to any page and the bar + menu appear automatically.
   - Bails out if the page already owns a `#nav` (i.e. we're on index.html).
   - Uses an `eh-` class prefix so nothing collides with host-page CSS.
     All tokens (colors, spacing, breakpoint) come from index.html's :root
     so the look is pixel-parity with the homepage.
   - All anchor links resolve against index.html so they work from any
     location; standalone page targets use their own filenames.
   - Language selection writes `ergsn_lang` to localStorage and navigates
     to index.html where the existing initLang bootstrap applies it
     (standalone pages don't carry the T map).
   - `@media print` hides the bar so PDF exports stay clean.
   - No user input is interpolated into markup — every string is a static
     literal, so innerHTML-based construction is safe. */
(function () {
  if (window.__ergsnHeaderInjected) return;
  window.__ergsnHeaderInjected = true;
  if (document.getElementById('nav')) return;

  /* Menu structure mirrors index.html's dropdowns one-for-one. The `a` field
     is the top-level dropdown heading (href is the landing anchor on
     index.html); items are the rows inside each dropdown. Items with a
     `divider:true` flag render as a hairline separator on desktop and are
     skipped on mobile. */
  var MENU = [
    {
      title: 'Shop',
      href: 'index.html#products',
      items: [
        { href: 'index.html#products', name: 'K-Security',      tag: 'Active', desc: 'DL Series shredders · in stock' },
        { href: 'index.html#products', name: 'K-Tech',          tag: 'Active', desc: '2D → 3D stereoscopic conversion' },
        { href: 'index.html#products', name: 'K-Energy',        tag: 'Active', desc: 'HYGEN Generator · one-shaft multi-gen' },
        { href: 'index.html#products', name: 'K-Bio',           tag: 'Active', desc: 'Rosetta Plus · HACCP · KFDA' },
        { href: 'index.html#products', name: 'K-Beauty',        tag: 'Sourcing', tagSoon: true, desc: 'Skincare · cosmetics · devices' },
        { href: 'index.html#products', name: 'K-Culture Goods', tag: 'Sourcing', tagSoon: true, desc: 'K-pop merch · crafts · fashion' },
        { href: 'index.html#products', name: 'K-Franchise',     tag: 'Sourcing', tagSoon: true, desc: 'F&B · retail · service concepts' },
        { href: 'index.html#products', name: 'K-Smart Living',  tag: 'Sourcing', tagSoon: true, desc: 'Appliances · wellness · lifestyle' },
        { href: 'index.html#match',    name: 'AI Partner Match',    desc: 'Country + industry → Top-3 matches' },
        { href: 'index.html#calculator', name: 'Quote Calculator',  desc: 'Instant CIF/FOB estimate' },
        { href: 'export-docs.html',    name: 'Export Documents AI', desc: 'HS code lookup · duty rates · templates' }
      ]
    },
    {
      title: 'For Buyers',
      href: 'index.html#wanted',
      items: [
        { href: 'index.html#wanted', name: 'Wanted Board',    desc: 'Post a sourcing need · anonymous' },
        { href: 'index.html#trend',  name: 'Trend Monthly',   desc: 'Monthly Korea export intelligence' },
        { divider: true },
        { href: 'buyers-healthcare.html',  name: 'Healthcare Procurement',  desc: 'HIPAA shredders · KFDA HFF · cleanroom' },
        { href: 'buyers-government.html',  name: 'Government Procurement',  desc: 'GSA Schedule · Level-3 · ministerial' },
        { href: 'buyers-hospitality.html', name: 'Hospitality & Retail',    desc: 'K-Beauty · K-Bio wellness · duty-free' }
      ]
    },
    {
      title: 'Trust',
      href: 'index.html#about',
      items: [
        { href: 'index.html#about',     name: 'About ERGSN',           desc: 'Trade platform identity & mission' },
        { href: 'index.html#cases',     name: 'Case Studies',          desc: 'Real shipments · real buyers' },
        { href: 'index.html#verify',    name: 'Verification Process',  desc: '4-step partner qualification' },
        { href: 'verified-partner.html', name: 'Verified Partner Program', desc: 'Official badge & certificate of verification' },
        { href: 'escrow.html',           name: 'Escrow Service',       desc: 'Protected T/T settlement · 1% pilot' },
        { href: 'index.html#map',        name: 'Trade Route Map',      desc: 'Global shipping lanes from Korea' },
        { href: 'index.html#compliance', name: 'Compliance',           desc: 'HIPAA · GSA · DIN 66399' },
        { href: 'index.html#qa',         name: 'Q&A Wall',             desc: 'Buyer community questions & answers' }
      ]
    },
    {
      title: 'Connect',
      href: 'index.html#rfq',
      items: [
        { href: 'index.html#rfq',   name: 'Request a Quote', desc: '2-step form · reply within 1 biz day' },
        { href: 'index.html#tools', name: 'Book a Demo',     desc: '30-min Zoom · compliance checker · landed cost' },
        { href: 'trade-mission.html', name: 'Trade Mission Live', desc: 'Quarterly broadcast · 5 makers × 50 buyers' },
        { href: 'tracker.html',       name: 'RFQ Tracker',        desc: 'Check status of submitted RFQ' },
        { href: 'https://t.me/ceodon',       name: 'Telegram',  desc: 'Chat directly with ERGSN trade team', external: true },
        { href: 'https://wa.me/821052880006', name: 'WhatsApp', desc: 'Chat directly with ERGSN trade team', external: true },
        { href: 'partners-kr.html', name: 'KR · 파트너 문의', kr: true, desc: '한국 제조사 입점 신청' }
      ]
    }
  ];

  var CSS = [
    /* Tokens copied from index.html :root so the bar renders identically
       even on pages that don't share those CSS variables. */
    ':root{--eh-navy-2:#111418;--eh-gold:#34d298;--eh-gold-light:#00ffa1;--eh-white:#fff;--eh-steel:#6b7685;--eh-steel-lt:#a7a7a7;--eh-border:#292929;--eh-nav-h:56px}',
    '#ehNav,#ehNav *,#ehMobileMenu,#ehMobileMenu *{box-sizing:border-box}',
    '#ehNav{position:fixed;top:0;left:0;right:0;z-index:900;height:56px;background:#111418;border-bottom:1px solid #1e252e;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    /* Push host page content below the 56px fixed bar. Using !important here
       because some standalone pages set body { margin: 0 } inline. */
    'body{padding-top:56px !important}',
    '#ehNav .eh-inner{max-width:1240px;margin:0 auto;height:100%;padding:0 clamp(16px,4vw,48px);display:flex;align-items:center;justify-content:space-between;gap:clamp(12px,2vw,24px)}',
    /* Logo — matches .nav-logo / .logo-mark styling from index.html */
    '#ehNav .eh-logo{display:flex;align-items:center;gap:0;text-decoration:none;flex-shrink:0}',
    '#ehNav .eh-logo-mark{font-size:clamp(22px,2.8vw,30px);font-weight:800;letter-spacing:.12em;text-transform:uppercase;line-height:1;background:linear-gradient(320deg,#a8a8a6 15%,#c2c0c0 48%,#f9f8f6 64%,#d4d4d4 76%,#7f7f7f 88%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:#fff}',
    '#ehNav .eh-logo-mark .eh-e{background:linear-gradient(84deg,#00bf79 42%,#00ffa1 81%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
    /* Right side */
    '#ehNav .eh-right{display:flex;align-items:center;gap:clamp(12px,2vw,20px)}',
    /* Desktop nav links */
    '#ehNav .eh-nav-links{display:flex;align-items:center;gap:clamp(16px,2vw,32px);list-style:none;margin:0;padding:0}',
    '#ehNav .eh-nav-links > li{margin:0;padding:0}',
    '#ehNav .eh-nav-links a{font-size:14px;font-weight:500;letter-spacing:.03em;color:#6b7685;transition:color .15s;text-decoration:none}',
    '#ehNav .eh-nav-links a:hover{color:#fff}',
    '#ehNav .eh-nav-links .eh-nav-cta{background:#34d298;color:#0f1110;padding:7px 18px;border-radius:20px;font-weight:600;transition:background .15s}',
    '#ehNav .eh-nav-links .eh-nav-cta:hover{background:#00ffa1}',
    /* Dropdown */
    '#ehNav .eh-nav-dropdown{position:relative}',
    '#ehNav .eh-nav-dropdown > a{padding:8px 0;display:inline-block}',
    '#ehNav .eh-nav-dropdown > a::after{content:" \\25BE";font-size:9px;opacity:.6}',
    '#ehNav .eh-nav-dropmenu{position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#111418;border:1px solid #292929;border-radius:10px;min-width:240px;padding:8px;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s,visibility .18s,transform .18s;margin-top:0;box-shadow:0 20px 40px rgba(0,0,0,.5);list-style:none;z-index:950}',
    '#ehNav .eh-nav-dropmenu::before{content:"";position:absolute;top:-14px;left:0;right:0;height:14px}',
    '#ehNav .eh-nav-dropdown:hover .eh-nav-dropmenu,#ehNav .eh-nav-dropdown:focus-within .eh-nav-dropmenu{opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
    '#ehNav .eh-nav-dropmenu li{display:block;margin:0}',
    '#ehNav .eh-nav-dropmenu a{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:6px;color:#fff;transition:background .15s}',
    '#ehNav .eh-nav-dropmenu a:hover{background:rgba(52,210,152,.1);color:#fff}',
    '#ehNav .eh-nav-dropmenu .eh-ds-name{font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px}',
    '#ehNav .eh-nav-dropmenu .eh-ds-tag{font-size:9px;padding:2px 6px;border-radius:8px;background:rgba(52,210,152,.15);color:#34d298;letter-spacing:.04em;text-transform:uppercase;font-weight:700}',
    '#ehNav .eh-nav-dropmenu .eh-ds-tag.eh-soon{background:rgba(255,255,255,.06);color:#a7a7a7}',
    '#ehNav .eh-nav-dropmenu .eh-ds-desc{font-size:11px;color:#6b7685;font-weight:400}',
    '#ehNav .eh-nav-dropmenu .eh-ds-divider{height:1px;background:rgba(255,255,255,.06);margin:6px 12px;padding:0;list-style:none}',
    '#ehNav .eh-nav-dropmenu .eh-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298;vertical-align:1px}',
    /* Language select */
    '#ehNav .eh-lang{font:inherit;font-size:12px;font-weight:600;letter-spacing:.06em;color:#cfcfcf;background:#141414;border:1px solid #292929;border-radius:7px;padding:6px 24px 6px 10px;outline:none;cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;background-image:linear-gradient(45deg,transparent 50%,#8a8b8d 50%),linear-gradient(135deg,#8a8b8d 50%,transparent 50%);background-position:calc(100% - 14px) 50%,calc(100% - 10px) 50%;background-size:4px 4px;background-repeat:no-repeat}',
    '#ehNav .eh-lang:hover,#ehNav .eh-lang:focus{border-color:#34d298;color:#fff}',
    /* Hamburger (desktop hidden, mobile shown) */
    '#ehNav .eh-ham{display:none;flex-direction:column;gap:5px;padding:6px;background:transparent;border:0;cursor:pointer}',
    '#ehNav .eh-ham span{width:22px;height:2px;background:#fff;border-radius:1px;transition:all .2s;display:block}',
    '#ehNav .eh-ham.eh-open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}',
    '#ehNav .eh-ham.eh-open span:nth-child(2){opacity:0}',
    '#ehNav .eh-ham.eh-open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}',
    '#ehNav .eh-ham:focus-visible,#ehNav .eh-nav-dropdown > a:focus-visible{outline:2px solid #34d298;outline-offset:3px}',
    /* Mobile menu slide-down */
    '#ehMobileMenu{display:none;position:fixed;top:56px;left:0;right:0;max-height:calc(100vh - 56px);overflow-y:auto;background:#111418;z-index:890;border-bottom:1px solid rgba(255,255,255,.08);padding:1.5rem clamp(24px,4vw,48px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    '#ehMobileMenu.eh-open{display:block}',
    '#ehMobileMenu ul{list-style:none;display:flex;flex-direction:column;gap:0;margin:0;padding:0}',
    '#ehMobileMenu a{display:block;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#a7a7a7;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05);transition:color .18s;text-decoration:none}',
    '#ehMobileMenu a:hover{color:#00ffa1}',
    '#ehMobileMenu .eh-m-cta{color:#34d298}',
    '#ehMobileMenu details{border-bottom:1px solid rgba(255,255,255,.06)}',
    '#ehMobileMenu details > summary{list-style:none;cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fff;padding:14px 4px}',
    '#ehMobileMenu details > summary::-webkit-details-marker{display:none}',
    '#ehMobileMenu details > summary::after{content:"+";font-size:20px;font-weight:400;color:#34d298;transition:transform .2s}',
    '#ehMobileMenu details[open] > summary::after{content:"−"}',
    '#ehMobileMenu details ul{padding:0 0 10px 4px}',
    '#ehMobileMenu details ul li a{padding:10px 0;font-size:14px}',
    '#ehMobileMenu .eh-kr-chip{display:inline-block;padding:1px 6px;margin-right:6px;border:1px solid #34d298;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#34d298}',
    '#ehMobileMenu .eh-lang{margin:16px 0;font:inherit;font-size:13px;color:#cfcfcf;background:#141414;border:1px solid #292929;border-radius:7px;padding:8px 12px;outline:none;width:160px}',
    /* Responsive swap — matches index.html breakpoint */
    '@media (max-width:680px){#ehNav .eh-nav-links{display:none}#ehNav .eh-ham{display:flex}#ehNav .eh-lang{display:none}}',
    /* Hide in print so spec sheets / invoices stay clean */
    '@media print{#ehNav,#ehMobileMenu{display:none !important}body{padding-top:0 !important}}'
  ].join('');

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildDesktopItem(it) {
    if (it.divider) return '<li class="eh-ds-divider" role="separator"></li>';
    var extAttrs = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var tagHtml = '';
    if (it.tag) {
      var tagCls = it.tagSoon ? 'eh-ds-tag eh-soon' : 'eh-ds-tag';
      tagHtml = ' <span class="' + tagCls + '">' + escapeHTML(it.tag) + '</span>';
    }
    var krChip = it.kr ? '<span class="eh-kr-chip">KR</span>' : '';
    return (
      '<li>' +
        '<a href="' + escapeHTML(it.href) + '"' + extAttrs + '>' +
          '<span class="eh-ds-name">' + krChip + escapeHTML(it.name) + tagHtml + '</span>' +
          (it.desc ? '<span class="eh-ds-desc">' + escapeHTML(it.desc) + '</span>' : '') +
        '</a>' +
      '</li>'
    );
  }

  function buildDesktopNav() {
    var dropdowns = MENU.map(function (col) {
      var items = col.items.map(buildDesktopItem).join('');
      return (
        '<li class="eh-nav-dropdown">' +
          '<a href="' + escapeHTML(col.href) + '">' + escapeHTML(col.title) + '</a>' +
          '<ul class="eh-nav-dropmenu">' + items + '</ul>' +
        '</li>'
      );
    }).join('');
    return (
      '<ul class="eh-nav-links">' +
        dropdowns +
        '<li><a href="index.html#rfq" class="eh-nav-cta">Request Quote</a></li>' +
      '</ul>'
    );
  }

  var LANG_OPTIONS =
    '<option value="en">EN</option>' +
    '<option value="es">ES</option>' +
    '<option value="ar">عربي</option>' +
    '<option value="fr">FR</option>' +
    '<option value="ja">日本語</option>' +
    '<option value="tr">TR</option>' +
    '<option value="zh-Hans">简体</option>' +
    '<option value="zh-Hant">繁體</option>';

  function buildMobileItem(it) {
    if (it.divider) return '';
    var extAttrs = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var krChip = it.kr ? '<span class="eh-kr-chip">KR</span>' : '';
    var tag = it.tag ? ' <span class="eh-ds-tag' + (it.tagSoon ? ' eh-soon' : '') + '">' + escapeHTML(it.tag) + '</span>' : '';
    return (
      '<li><a href="' + escapeHTML(it.href) + '"' + extAttrs + '>' + krChip + escapeHTML(it.name) + tag + '</a></li>'
    );
  }

  function buildMobileMenu() {
    var sections = MENU.map(function (col) {
      var lis = col.items.map(buildMobileItem).join('');
      var open = col.title === 'Shop' ? ' open' : '';
      return (
        '<details' + open + '>' +
          '<summary>' + escapeHTML(col.title) + '</summary>' +
          '<ul>' + lis + '</ul>' +
        '</details>'
      );
    }).join('');
    return (
      '<div id="ehMobileMenu" aria-hidden="true">' +
        sections +
        '<select class="eh-lang" aria-label="Language">' + LANG_OPTIONS + '</select>' +
      '</div>'
    );
  }

  function buildNav() {
    return (
      '<nav id="ehNav" role="banner">' +
        '<div class="eh-inner">' +
          '<a href="index.html" class="eh-logo" aria-label="ERGSN home">' +
            '<span class="eh-logo-mark"><span class="eh-e">E</span>RGSN</span>' +
          '</a>' +
          '<div class="eh-right">' +
            buildDesktopNav() +
            '<select class="eh-lang" aria-label="Language">' + LANG_OPTIONS + '</select>' +
            '<button type="button" class="eh-ham" aria-label="Menu" aria-expanded="false" aria-controls="ehMobileMenu">' +
              '<span></span><span></span><span></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</nav>'
    );
  }

  function inject() {
    if (!document.body) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildNav() + buildMobileMenu();
    var nodes = Array.prototype.slice.call(wrapper.children);
    // Insert at body start, preserving order
    for (var i = nodes.length - 1; i >= 0; i--) {
      document.body.insertBefore(nodes[i], document.body.firstChild);
    }

    var ham = document.querySelector('#ehNav .eh-ham');
    var menu = document.getElementById('ehMobileMenu');
    function closeMenu() {
      if (!menu) return;
      menu.classList.remove('eh-open');
      menu.setAttribute('aria-hidden', 'true');
      if (ham) { ham.classList.remove('eh-open'); ham.setAttribute('aria-expanded', 'false'); }
    }
    if (ham && menu) {
      ham.addEventListener('click', function () {
        var nowOpen = !menu.classList.contains('eh-open');
        menu.classList.toggle('eh-open', nowOpen);
        ham.classList.toggle('eh-open', nowOpen);
        ham.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        menu.setAttribute('aria-hidden', nowOpen ? 'false' : 'true');
      });
      menu.addEventListener('click', function (e) {
        if (e.target && e.target.tagName === 'A') closeMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('eh-open')) closeMenu();
      });
    }

    var langs = document.querySelectorAll('#ehNav .eh-lang, #ehMobileMenu .eh-lang');
    try {
      var saved = localStorage.getItem('ergsn_lang');
      if (saved) {
        langs.forEach(function (sel) {
          for (var j = 0; j < sel.options.length; j++) {
            if (sel.options[j].value === saved) { sel.value = saved; break; }
          }
        });
      }
    } catch (_) {}
    langs.forEach(function (sel) {
      sel.addEventListener('change', function () {
        var target = sel.value;
        try { localStorage.setItem('ergsn_lang', target); } catch (_) {}
        if (typeof window.setLang === 'function') { window.setLang(target); return; }
        window.location.href = 'index.html';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
