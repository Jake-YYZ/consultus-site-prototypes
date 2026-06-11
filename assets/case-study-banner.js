/* ============================================================
   Consultus Digital — Sticky Case Study Video Banner
   ------------------------------------------------------------
   Site-wide floating video promo for the E11ement case study.

   Behavior spec (for WordPress rebuild):
   - First page of a visit: card slides in bottom-right after
     1.2s, video auto-plays MUTED and loops (browser rules block
     sound before a user click).
   - Clicking the video (or the expand icon) opens a full-screen
     theater with sound, resuming from where the teaser was.
   - Closing the card collapses it to a slim pill. Later pages in
     the same visit also show just the pill. The pill reopens the
     theater on click.
   - State is kept in sessionStorage, so every NEW visit gets the
     full auto-open treatment again.
   - Respects prefers-reduced-motion (no autoplay, no slide).
   - Video host: Wistia, media id 3fl1o2nq2n.
   ============================================================ */
(function () {
  'use strict';

  var WISTIA_ID = '3fl1o2nq2n';
  var TITLE = 'E11ement Case Study';
  var SUBTITLE = 'Tap to watch with sound';
  // Links work both at a domain root (real site, local preview) and under
  // the GitHub Pages project prefix.
  var BASE = location.pathname.indexOf('/consultus-site-prototypes/') === 0 ? '/consultus-site-prototypes' : '';
  var CASES_URL = BASE + '/case-studies/';
  var CONTACT_URL = BASE + '/contact/';
  var STATE_KEY = 'csBannerState'; // '' = first visit, 'pill' = collapsed
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Skip on the case studies hub itself; the page already is the pitch.
  if (location.pathname.replace(/\/+$/, '/').indexOf('/case-studies/') !== -1) return;

  var state;
  try { state = sessionStorage.getItem(STATE_KEY) || ''; } catch (e) { state = ''; }

  /* ---------- styles ---------- */
  var css = [
    '#csb-card{position:fixed;right:20px;bottom:20px;width:320px;z-index:99990;background:#141414;border:1px solid #262626;border-radius:14px;overflow:hidden;box-shadow:0 18px 48px rgba(13,13,13,0.35);transform:translateY(24px);opacity:0;transition:transform .45s cubic-bezier(.22,1,.36,1),opacity .45s ease;font-family:\'NuberNext\',\'Helvetica Neue\',Arial,sans-serif}',
    '#csb-card.csb-in{transform:translateY(0);opacity:1}',
    '#csb-card .csb-top{display:flex;align-items:center;gap:8px;padding:10px 12px}',
    '#csb-card .csb-dot{width:6px;height:6px;border-radius:50%;background:#FFEC00;flex:none}',
    '#csb-card .csb-lbl{font-family:ui-monospace,\'SF Mono\',Menlo,Consolas,monospace;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#C7C5C8;flex:1}',
    '.csb-icon{background:none;border:none;cursor:pointer;color:#C7C5C8;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0;transition:background .2s ease,color .2s ease}',
    '.csb-icon:hover{background:#FFEC00;color:#141414}',
    '#csb-card .csb-video{position:relative;aspect-ratio:16/9;background:#0D0D0D;cursor:pointer}',
    '#csb-card .csb-video .wistia_embed{width:100%;height:100%}',
    '#csb-card .csb-hit{position:absolute;inset:0;z-index:5;background:transparent;border:none;cursor:pointer;padding:0}',
    '#csb-card .csb-bottom{padding:12px 14px 14px}',
    '#csb-card .csb-title{font-size:14px;font-weight:600;color:#FAF8F3;letter-spacing:-.01em}',
    '#csb-card .csb-sub{font-size:12px;color:#8A878B;margin-top:2px}',
    '#csb-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:99990;display:flex;align-items:center;gap:6px;background:#141414;border:1px solid #262626;border-radius:100px;padding:6px;font-family:\'NuberNext\',\'Helvetica Neue\',Arial,sans-serif;box-shadow:0 16px 40px rgba(13,13,13,0.35)}',
    '#csb-dock .csb-dock-video{display:inline-flex;align-items:center;gap:9px;background:transparent;border:none;color:#FAF8F3;border-radius:100px;padding:10px 16px;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .25s ease,color .25s ease}',
    '#csb-dock .csb-dock-video:hover{background:#FFEC00;color:#141414}',
    '#csb-dock .csb-play{width:0;height:0;border-left:8px solid #FFEC00;border-top:5px solid transparent;border-bottom:5px solid transparent;transition:border-color .25s ease;flex:none}',
    '#csb-dock .csb-dock-video:hover .csb-play{border-left-color:#141414}',
    '#csb-dock .csb-dock-sep{width:1px;height:22px;background:rgba(255,255,255,0.16);flex:none}',
    '#csb-dock .csb-dock-explore{display:inline-flex;align-items:baseline;gap:7px;padding:10px 14px;color:#C7C5C8;font-size:12px;text-decoration:none;border-radius:100px;transition:color .2s ease;min-width:200px}',
    '#csb-dock .csb-dock-explore:hover{color:#FFEC00}',
    '#csb-dock .csb-dock-explore .csb-x-lbl{font-family:ui-monospace,\'SF Mono\',Menlo,Consolas,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8A878B;flex:none}',
    '#csb-dock .csb-dock-explore .csb-x-svc{font-weight:500;color:inherit;white-space:nowrap;transition:opacity .3s ease}',
    '#csb-dock .csb-dock-explore .csb-x-svc.csb-fade{opacity:0}',
    '#csb-dock .csb-dock-cta{display:inline-flex;align-items:center;background:#FFEC00;color:#141414;border-radius:100px;padding:10px 20px;font-size:13px;font-weight:600;text-decoration:none;transition:background .25s ease,color .25s ease,transform .2s ease;flex:none}',
    '#csb-dock .csb-dock-cta:hover{background:#FAF8F3;transform:translateY(-1px)}',
    '@media (max-width:760px){#csb-dock .csb-dock-explore,#csb-dock .csb-dock-sep{display:none}#csb-dock{bottom:12px}}',
    '#csb-theater{position:fixed;inset:0;z-index:99999;background:rgba(13,13,13,.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .3s ease}',
    '#csb-theater.csb-in{opacity:1}',
    '#csb-theater .csb-stage{width:min(960px,94vw);font-family:\'NuberNext\',\'Helvetica Neue\',Arial,sans-serif}',
    '#csb-theater .csb-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
    '#csb-theater .csb-head .csb-dot{width:6px;height:6px;border-radius:50%;background:#FFEC00}',
    '#csb-theater .csb-head .csb-lbl{font-family:ui-monospace,\'SF Mono\',Menlo,Consolas,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#C7C5C8;flex:1}',
    '#csb-theater .csb-frame{aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}',
    '#csb-theater .csb-frame .wistia_embed{width:100%;height:100%}',
    '#csb-theater .csb-ctas{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}',
    '.csb-btn{display:inline-flex;align-items:center;padding:14px 26px;border-radius:100px;font-size:14px;font-weight:500;text-decoration:none;font-family:inherit;transition:background .25s ease,color .25s ease,transform .2s ease}',
    '.csb-btn.csb-primary{background:#FAF8F3;color:#141414}',
    '.csb-btn.csb-primary:hover{background:#FFEC00;transform:translateY(-1px)}',
    '.csb-btn.csb-ghost{border:1px solid rgba(255,255,255,.4);color:#FAF8F3;background:transparent}',
    '.csb-btn.csb-ghost:hover{border-color:#FFEC00;color:#FFEC00}',
    '@media (max-width:640px){#csb-card{right:12px;bottom:12px;width:min(300px,calc(100vw - 24px))}#csb-theater{padding:12px}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- Wistia loader ---------- */
  window._wq = window._wq || [];
  function loadWistia() {
    if (document.getElementById('csb-wistia-api')) return;
    var s = document.createElement('script');
    s.id = 'csb-wistia-api';
    s.src = 'https://fast.wistia.net/assets/external/E-v1.js';
    s.async = true;
    document.head.appendChild(s);
  }

  var miniHandle = null;
  var theaterEl = null;
  var autoplayMini = false;

  /* One dispatcher for every embed of this media on the page.
     The teaser card starts muted; the theater starts with sound
     (allowed because opening it was a user click). */
  window._wq.push({
    id: WISTIA_ID,
    onReady: function (video) {
      var inTheater = video.container && video.container.closest && video.container.closest('#csb-theater');
      if (inTheater) {
        try { video.unmute(); video.play(); } catch (e) {}
      } else if (!miniHandle) {
        miniHandle = video;
        if (autoplayMini) { try { video.mute(); video.play(); } catch (e) {} }
      }
    }
  });

  /* ---------- card (auto-open, muted teaser) ---------- */
  function buildCard() {
    var card = document.createElement('div');
    card.id = 'csb-card';
    card.innerHTML =
      '<div class="csb-top">' +
        '<span class="csb-dot"></span>' +
        '<span class="csb-lbl">New Case Study</span>' +
        '<button class="csb-icon" data-csb="expand" aria-label="Expand video" title="Watch full screen">' +
          '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5L8 6M1.5 12.5L6 8"/></svg>' +
        '</button>' +
        '<button class="csb-icon" data-csb="close" aria-label="Close video banner">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 1l10 10M11 1L1 11"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="csb-video">' +
        '<div class="wistia_embed wistia_async_' + WISTIA_ID +
          ' silentAutoPlay=allow endVideoBehavior=loop playbar=false playButton=false smallPlayButton=false volumeControl=false fullscreenButton=false settingsControl=false playbackRateControl=false qualityControl=false controlsVisibleOnLoad=false">&nbsp;</div>' +
        '<button class="csb-hit" data-csb="expand" aria-label="Watch case study video with sound"></button>' +
      '</div>' +
      '<div class="csb-bottom" data-csb="expand" style="cursor:pointer">' +
        '<div class="csb-title">' + TITLE + '</div>' +
        '<div class="csb-sub">' + SUBTITLE + '</div>' +
      '</div>';
    document.body.appendChild(card);
    // Mark the auto-open as used: any page visited after this one
    // in the same browsing session shows only the compact pill.
    try { sessionStorage.setItem(STATE_KEY, 'pill'); } catch (e) {}
    autoplayMini = !reduceMotion;
    loadWistia();
    requestAnimationFrame(function () {
      setTimeout(function () { card.classList.add('csb-in'); }, reduceMotion ? 0 : 1200);
    });
    card.addEventListener('click', function (e) {
      var t = e.target.closest('[data-csb]');
      if (!t) return;
      if (t.getAttribute('data-csb') === 'close') collapseToPill();
      else openTheater();
    });
    return card;
  }

  /* ---------- dock (collapsed state) ----------
     Persistent conversion bar: video pill + rotating service link +
     Book a Call. Replaces the old lone pill. */
  var EXPLORE = [
    { label: 'Google Ads', href: '/google-ads/' },
    { label: 'Meta Ads', href: '/meta-ads/' },
    { label: 'SEO', href: '/seo/' },
    { label: 'Conversion Rate Optimization', href: '/cro/' },
    { label: 'Web Development', href: '/web-development/' },
    { label: 'Performance Creatives', href: '/performance-creatives/' },
    { label: 'Zoho CRM', href: '/zoho-crm/' }
  ];

  function buildDock() {
    var dock = document.createElement('div');
    dock.id = 'csb-dock';
    dock.innerHTML =
      '<button class="csb-dock-video" aria-label="Watch the ' + TITLE + '">' +
        '<span class="csb-play"></span><span>' + TITLE + '</span>' +
      '</button>' +
      '<span class="csb-dock-sep"></span>' +
      '<a class="csb-dock-explore" href="' + BASE + EXPLORE[0].href + '">' +
        '<span class="csb-x-lbl">Explore</span>' +
        '<span class="csb-x-svc">' + EXPLORE[0].label + ' &rarr;</span>' +
      '</a>' +
      '<span class="csb-dock-sep"></span>' +
      '<a class="csb-dock-cta" href="' + CONTACT_URL + '">Book a Call</a>';
    document.body.appendChild(dock);
    dock.querySelector('.csb-dock-video').addEventListener('click', openTheater);

    var i = 0;
    var link = dock.querySelector('.csb-dock-explore');
    var svc = dock.querySelector('.csb-x-svc');
    if (!reduceMotion) {
      setInterval(function () {
        svc.classList.add('csb-fade');
        setTimeout(function () {
          i = (i + 1) % EXPLORE.length;
          svc.innerHTML = EXPLORE[i].label + ' &rarr;';
          link.href = BASE + EXPLORE[i].href;
          svc.classList.remove('csb-fade');
        }, 300);
      }, 3500);
    }
    return dock;
  }

  function removeEl(id) { var el = document.getElementById(id); if (el) el.parentNode.removeChild(el); }

  function collapseToPill() {
    if (miniHandle) { try { miniHandle.pause(); } catch (e) {} }
    removeEl('csb-card');
    if (!document.getElementById('csb-dock')) buildDock();
    try { sessionStorage.setItem(STATE_KEY, 'pill'); } catch (e) {}
  }

  /* ---------- theater (big, with sound) ---------- */
  function openTheater() {
    if (theaterEl) return;
    var resumeAt = 0;
    if (miniHandle) {
      try { resumeAt = Math.max(0, Math.floor(miniHandle.time()) - 1); miniHandle.pause(); } catch (e) {}
    }
    theaterEl = document.createElement('div');
    theaterEl.id = 'csb-theater';
    theaterEl.setAttribute('role', 'dialog');
    theaterEl.setAttribute('aria-label', TITLE);
    theaterEl.innerHTML =
      '<div class="csb-stage">' +
        '<div class="csb-head">' +
          '<span class="csb-dot"></span>' +
          '<span class="csb-lbl">Case Study / E11ement</span>' +
          '<button class="csb-icon" data-csb="close-theater" aria-label="Close">' +
            '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 1l10 10M11 1L1 11"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="csb-frame">' +
          '<div class="wistia_embed wistia_async_' + WISTIA_ID + ' autoPlay=true muted=false time=' + resumeAt + ' playerColor=1A40C7">&nbsp;</div>' +
        '</div>' +
        '<div class="csb-ctas">' +
          '<a class="csb-btn csb-primary" href="' + CASES_URL + '">See All Case Studies</a>' +
          '<a class="csb-btn csb-ghost" href="' + CONTACT_URL + '">Book a Call</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(theaterEl);
    loadWistia();
    requestAnimationFrame(function () { theaterEl.classList.add('csb-in'); });
    theaterEl.addEventListener('click', function (e) {
      if (e.target === theaterEl || e.target.closest('[data-csb="close-theater"]')) closeTheater();
    });
    document.addEventListener('keydown', escClose);
    document.documentElement.style.overflow = 'hidden';
  }

  function escClose(e) { if (e.key === 'Escape') closeTheater(); }

  function closeTheater() {
    if (!theaterEl) return;
    // Stop theater audio by removing its embed outright.
    theaterEl.parentNode.removeChild(theaterEl);
    theaterEl = null;
    document.removeEventListener('keydown', escClose);
    document.documentElement.style.overflow = '';
    collapseToPill();
  }

  /* ---------- boot ---------- */
  function boot() {
    if (state === 'pill') buildDock();
    else buildCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
