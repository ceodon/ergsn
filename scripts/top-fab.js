/* ERGSN Top FAB — standalone scroll-triggered "back to top" button.
   Same visual + behavior as scripts/header.js's bundled Top FAB, but
   self-contained so admin pages and the maker/buyer review tools can
   include it without pulling the public nav.

   Self-injecting: load this script and the FAB appears on first scroll
   past 400 px. Bails out if scripts/header.js already added one. */
(function () {
  if (window.__ergsnTopFabInjected) return;
  if (document.getElementById('ehToTop')) return;
  window.__ergsnTopFabInjected = true;

  var CSS = [
    ':root{--ergsn-bottom-cta-h:0px;--ergsn-chat-lift:0px}',
    '@media (max-width:760px){:root{--ergsn-bottom-cta-h:60px}}',
    '#ehToTop{position:fixed;right:clamp(16px,3vw,32px);bottom:calc(clamp(16px,3vw,32px) + var(--ergsn-bottom-cta-h, 0px));width:48px;height:48px;background:#171717;color:#34d298;border:1px solid #292929;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -10px rgba(0,0,0,.55);cursor:pointer;opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .25s ease,transform .25s ease,visibility .25s,background .15s,color .15s;z-index:800;padding:0}',
    '#ehToTop.eh-visible{opacity:1;visibility:visible;transform:translateY(0)}',
    '#ehToTop:hover{background:#34d298;color:#0f1110}',
    '#ehToTop svg{width:20px;height:20px}',
    '@media (max-width:600px){#ehToTop{width:44px;height:44px}}',
    '@media print{#ehToTop{display:none !important}}'
  ].join('');

  var MARKUP = (
    '<button id="ehToTop" type="button" aria-label="Back to top">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>' +
    '</button>'
  );

  function inject() {
    if (!document.body) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var w = document.createElement('div');
    w.innerHTML = MARKUP;
    while (w.firstChild) document.body.appendChild(w.firstChild);

    var btn = document.getElementById('ehToTop');
    if (!btn) return;
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    var ticking = false;
    var docRoot = document.documentElement;
    function update() {
      var y = window.scrollY || docRoot.scrollTop;
      var show = y > 400;
      btn.classList.toggle('eh-visible', show);
      docRoot.style.setProperty('--ergsn-chat-lift', show ? '60px' : '0px');
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
