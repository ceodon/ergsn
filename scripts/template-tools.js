/* ─────────────────────────────────────────────────────────────────
   ERGSN export-doc templates — brand customization (logo + name).
   Loaded by invoice/proforma/packing-list/co templates.

   Behavior:
   - Default brand: ERGSN + "Korea · Trade Gateway · Since 2013"
   - User can edit company name/subtitle inline (text inputs)
   - User can upload a logo image (replaces text); 'Reset' restores default
   - All changes persist in localStorage and apply to all 4 templates
   ───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'ergsn-template-brand';
  var DEFAULTS = {
    name: 'ERGSN',
    sub:  'Korea · Trade Gateway · Since 2013',
    image: null
  };

  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function save(brand) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(brand)); }
    catch (_) {}
  }

  function applyBrand() {
    var brand = loadSaved();
    var nameEl = document.getElementById('brandName');
    var subEl  = document.getElementById('brandSub');
    var imgEl  = document.getElementById('brandImage');

    if (nameEl) nameEl.value = (brand.name != null) ? brand.name : DEFAULTS.name;
    if (subEl)  subEl.value  = (brand.sub  != null) ? brand.sub  : DEFAULTS.sub;

    if (imgEl) {
      if (brand.image) {
        imgEl.src = brand.image;
        imgEl.classList.add('show');
      } else {
        imgEl.removeAttribute('src');
        imgEl.classList.remove('show');
      }
    }
  }

  window.handleLogoUpload = function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image must be under 2 MB. Please pick a smaller file.');
      event.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var brand = loadSaved();
      brand.image = e.target.result;
      save(brand);
      applyBrand();
    };
    reader.onerror = function () {
      alert('Could not read that file. Please try a different image.');
    };
    reader.readAsDataURL(file);
    event.target.value = ''; /* allow re-upload of the same filename */
  };

  window.handleBrandTextChange = function () {
    var nameEl = document.getElementById('brandName');
    var subEl  = document.getElementById('brandSub');
    var brand = loadSaved();
    if (nameEl) brand.name = nameEl.value;
    if (subEl)  brand.sub  = subEl.value;
    save(brand);
  };

  window.resetBrand = function () {
    if (!window.confirm('Reset brand to ERGSN default? This clears your saved company name, subtitle, and logo on all four templates.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    applyBrand();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand);
  } else {
    applyBrand();
  }

  /* ── Defensive print hide ──────────────────────────────────────
     CSS-based @media print rules can fail to apply when the user's
     browser is serving a stale cached copy of styles/template-shared.css
     (CF edge cache, browser HTTP cache, or service worker pre-bump
     window). Setting inline `style="display: none !important"` via JS
     at beforeprint runs LIVE — no cache, no specificity escape. We
     restore the original style attribute on afterprint so the page
     remains interactive.
     Targets: the public-chrome elements injected by header.js /
     footer.js / chat.js / top-fab.js, plus our .tools toolbar. */
  var PRINT_HIDE_SEL =
    '.tools, #ehNav, #ergsnFooter, #ehToTop, #chatToggle, #chatPanel, ' +
    '.wa-fab, .ergsn-back-top, .ergsn-back-bottom';

  window.addEventListener('beforeprint', function () {
    var nodes = document.querySelectorAll(PRINT_HIDE_SEL);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.setAttribute('data-prev-style', el.getAttribute('style') || '');
      el.style.setProperty('display', 'none', 'important');
    }
  });

  window.addEventListener('afterprint', function () {
    var nodes = document.querySelectorAll('[data-prev-style]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var prev = el.getAttribute('data-prev-style');
      if (prev) { el.setAttribute('style', prev); }
      else { el.removeAttribute('style'); }
      el.removeAttribute('data-prev-style');
    }
  });
})();
