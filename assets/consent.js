/* Cookie consent and tag loading (Oct 9 2026).
   Google Tag Manager (analytics and advertising pixels) and the Zoho SalesIQ chat widget load only on consultusdigital.com
   and only after the visitor accepts. The choice is kept in localStorage for 12 months. Any element with
   [data-cookie-settings] (the footer link "Cookie settings") reopens the banner. On other hosts (staging, localhost) the
   banner works but nothing is loaded. To change who sees the banner, edit needsChoice(). */
(function () {
  'use strict';
  var KEY = 'cd-consent';
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  var PROD = /(^|\.)consultusdigital\.com$/.test(location.hostname);
  var GTM_ID = 'GTM-MGSZK8WC';
  var SIQ_SRC = 'https://salesiq.zohopublic.com/widget?plugin_source=wordpress&wc=siq4a880dd3f7acb88b805a31be4aa7a29d822018abc07f74e9c9ca128c8e974080';
  var tagsLoaded = false;
  var banner = null;
  var opener = null;

  function read() {
    try {
      var r = JSON.parse(localStorage.getItem(KEY));
      if (r && (r.v === 'granted' || r.v === 'denied') && Date.now() - r.t < MAX_AGE) return r.v;
    } catch (e) {}
    return null;
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }

  // Everyone is asked today. A region test could go here (for example only the UK, the EU and Quebec).
  function needsChoice() { return true; }

  function loadTags() {
    if (tagsLoaded || !PROD) return;
    tagsLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
    window.$zoho = window.$zoho || {};
    window.$zoho.salesiq = window.$zoho.salesiq || { ready: function () {} };
    var z = document.createElement('script');
    z.id = 'zsiqscript';
    z.defer = true;
    z.src = SIQ_SRC;
    document.head.appendChild(z);
  }

  var CSS = '#cd-consent{position:fixed;left:16px;bottom:16px;z-index:850;box-sizing:border-box;width:calc(100% - 32px);max-width:560px;' +
    'padding:18px 20px;background:#FAF8F3;color:#141414;border:1px solid #E1DCD1;border-radius:14px;box-shadow:0 12px 40px rgba(20,20,20,.18);' +
    "font-family:'NuberNext','Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.5}" +
    '#cd-consent[hidden]{display:none!important}' +
    '#cd-consent p{margin:0 0 14px;color:#141414}' +
    '#cd-consent a{color:#1A40C7;text-decoration:underline}' +
    '#cd-consent .cd-btns{display:flex;gap:10px;flex-wrap:wrap}' +
    '#cd-consent button{font:inherit;font-size:13px;font-weight:500;line-height:1;padding:12px 22px;border-radius:100px;border:1px solid #141414;cursor:pointer;' +
    'transition:background .25s ease,color .25s ease,border-color .25s ease}' +
    '#cd-consent .cd-yes{background:#141414;color:#FAF8F3}' +
    '#cd-consent .cd-yes:hover{background:#FFEC00;color:#141414;border-color:#141414}' +
    '#cd-consent .cd-no{background:transparent;color:#141414}' +
    '#cd-consent .cd-no:hover{background:#141414;color:#FAF8F3}' +
    '#cd-consent button:focus-visible,#cd-consent a:focus-visible{outline:2px solid #1A40C7;outline-offset:2px}' +
    '@media (max-width:600px){#cd-consent{left:12px;bottom:12px;width:calc(100% - 24px);padding:16px}#cd-consent button{flex:1 1 0}}' +
    '@media print{#cd-consent{display:none!important}}';

  function build() {
    if (banner) return banner;
    var style = document.createElement('style');
    style.id = 'cd-consent-css';
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
    banner = document.createElement('div');
    banner.id = 'cd-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.hidden = true;
    banner.innerHTML = '<p>We use cookies for analytics, advertising and live chat. Accept or decline, the site works either way. ' +
      '<a href="/privacy-policy/#cookies">Privacy policy</a></p>' +
      '<div class="cd-btns"><button type="button" class="cd-yes" data-cd="granted">Accept</button><button type="button" class="cd-no" data-cd="denied">Decline</button></div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-cd]') : null;
      if (b) choose(b.getAttribute('data-cd'));
    });
    banner.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && read()) hide(true);   // reopened from the footer: close without changing the choice
    });
    var skip = document.querySelector('.skip-link, .gads-skip');
    if (skip && skip.parentNode === document.body) document.body.insertBefore(banner, skip.nextSibling);
    else document.body.insertBefore(banner, document.body.firstChild);
    return banner;
  }

  function show(focus) {
    build().hidden = false;
    if (focus) { var y = banner.querySelector('.cd-yes'); if (y) y.focus(); }
  }
  function hide(restoreFocus) {
    if (banner) banner.hidden = true;
    if (restoreFocus && opener && opener.focus) opener.focus();
    opener = null;
  }

  function choose(v) {
    var before = read();
    write(v);
    hide(true);
    if (v === 'granted') loadTags();
    else if (before === 'granted' && tagsLoaded) location.reload();   // switching off: reload so the tags are gone
  }

  function init() {
    var state = read();
    if (state === 'granted') loadTags();
    else if (state === null && needsChoice()) show(false);
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (!t) return;
      e.preventDefault();
      opener = t;
      show(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
