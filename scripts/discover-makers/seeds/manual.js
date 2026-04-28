'use strict';

/**
 * Hand-curated seed lists per ERGSN sector. Used to validate the verify
 * pipeline + provide a baseline before automated seeds (Brave Search,
 * EC21 crawler) take over.
 *
 * Each list is intentionally small (5-12 makers) — the goal is signal,
 * not coverage. The automated seeds will fill in the long-tail SMEs.
 *
 * Selection bias: well-known mid-to-large OEM/ODM names + listed companies.
 * URLs may redirect — the pipeline normalises and follows redirects itself.
 */

const SECTORS = {
  'k-beauty': [
    'https://www.cosmax.com/',
    'https://www.kolmar.co.kr/',
    'https://www.cosmecca.com/',
    'https://www.amorepacific.com/',
    'https://www.lghnh.com/',
    'https://www.medytox.com/',
    'https://www.hugel.co.kr/',
    'https://www.itc-cos.com/'
  ],
  'k-bio': [
    'https://www.celltrion.com/',
    'https://www.samsungbiologics.com/',
    'https://www.sdbiosensor.com/',
    'https://www.seegene.com/',
    'https://www.osstem.com/',
    'https://www.dentium.com/',
    'https://www.megagen.com/',
    'https://www.hanmi.co.kr/',
    'https://www.gccorp.com/',
    'https://www.yuhan.co.kr/'
  ],
  'k-security': [
    'https://www.idis.co.kr/',
    'https://www.suprema.co.kr/',
    'https://www.hanwhavision.com/',
    'https://www.pentasecurity.com/',
    'https://www.markany.com/',
    'https://www.unetsystem.co.kr/'
  ],
  'k-energy': [
    'https://www.lgensol.com/',
    'https://www.samsungsdi.com/',
    'https://www.skon.co.kr/',
    'https://www.qcells.com/',
    'https://www.hyundai-elec.com/',
    'https://www.hanwha-solutions.com/',
    'https://www.dooosanenerbility.com/',
    'https://www.lselectric.co.kr/'
  ],
  'k-smart-living': [
    'https://www.coway.com/',
    'https://www.cuckoo.co.kr/',
    'https://www.winix.com/',
    'https://www.sk-magic.com/',
    'https://www.lge.com/',
    'https://www.samsung.com/sec/'
  ],
  'k-tech': [
    'https://www.samsung.com/',
    'https://www.lge.com/',
    'https://www.skhynix.com/',
    'https://www.lginnotek.com/',
    'https://www.hanwhasystems.com/',
    'https://www.doosan.com/',
    'https://www.lscable.com/',
    'https://www.kt.com/',
    'https://www.posco.com/'
  ],
  'k-culture-goods': [
    'https://www.kwangjuyo.com/',
    'https://www.leeyounghee.com/',
    'https://www.hanji.com/',
    'https://www.hyangwoo.co.kr/',
    'https://www.korean-traditional-craft.org/'
  ],
  'k-franchise': [
    'https://www.parisbaguette.com/',
    'https://www.tljus.com/',
    'https://www.bbq.co.kr/',
    'https://www.bonchon.com/',
    'https://www.momstouchglobal.com/',
    'https://www.caffebene.com/',
    'https://www.hollys.co.kr/',
    'https://www.cjfoodville.co.kr/'
  ],
  'k-tourism-assets': [
    'https://www.lottehotel.com/',
    'https://www.shillahotels.com/',
    'https://www.walkerhill.com/',
    'https://www.hanatour.com/',
    'https://www.modetour.com/',
    'https://www.interpark.com/',
    'https://www.parnashotels.com/'
  ]
};

function load(sector) {
  const list = SECTORS[sector];
  if (!list) {
    throw new Error(`No manual seed list for sector "${sector}". Available: ${Object.keys(SECTORS).join(', ')}`);
  }
  return list.map(url => ({
    url,
    sourceLabel: 'manual',
    sourceQuery: `manual:${sector}`,
    sectorHint: sector
  }));
}

function loadAll() {
  return Object.keys(SECTORS).flatMap(sector => load(sector));
}

function availableSectors() { return Object.keys(SECTORS); }

module.exports = { load, loadAll, availableSectors };
