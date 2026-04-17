/* ERGSN shared configuration — public surface only.
   Referenced by standalone HTML pages (trade-mission, escrow) that don't
   have the main index.html bundle. index.html has its own inlined copies.
   Any secret keys MUST stay in Cloudflare Worker secrets, never here. */
(function (global) {
  'use strict';
  global.ERGSN_CONFIG = Object.freeze({
    RFQ_ENDPOINT: 'https://formsubmit.co/ajax/ceodon@gmail.com',
    RFQ_CC:       'ceodon69@gmail.com',
    TG_PROXY_URL: 'https://cool-meadow-ergsn-tg-655a.ceodon.workers.dev/',
    TRACKER_URL:  'https://ergsn-rfq-tracker.ceodon.workers.dev'
  });
})(window);
