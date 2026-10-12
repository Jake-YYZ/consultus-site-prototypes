// Safari-engine QA with Playwright's WebKit build (no Apple account, no Xcode). One-time setup:
//   cd tools/qa/webkit && npm install && npx playwright install webkit      (about 300 MB in ~/Library/Caches/ms-playwright)
// usage: node tools/qa/qa_webkit.mjs --base=https://stg-consultusdigital-staging.kinsta.cloud --pages=,cro,about --mode=both --out=DIR
//        node tools/qa/qa_webkit.mjs --base=... --all --mode=phone          (every folder with an index.html, from the repo root)
// Options: --mode=phone|desktop|both (default both; phone = iPhone 15 size, Mobile Safari user agent, touch, 3x)
//          --shots=1 viewport screenshots (add --full=1 for full-page ones)   --nomenu=1 skips the menu / FAQ clicks
// Per page and mode it reports: console errors and warnings, uncaught errors, failed requests, HTTP 4xx/5xx, horizontal overflow,
// broken images, videos that did not start, photos drawn at the wrong shape (STRETCHED), logos wider than their card (LOGO CLIPPED), a Services menu /
// phone menu / FAQ interaction test (never submits the contact form).
// WebKit here is Playwright's own build of the Safari engine: close to Safari, not the iOS Simulator (no Safari UI, no iOS quirks).
import fs from 'node:fs';
import path from 'node:path';
import { webkit, devices } from './webkit/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = (args.base || 'http://localhost:8080').replace(/\/$/, '');
const MODE = args.mode || 'both';
const OUT = args.out || null;
const SHOTS = args.shots === '1' || args.shots === true;
const FULL = args.full === '1' || args.full === true;
const SKIP = new Set(['.git', 'node_modules', 'tools', 'docs', 'seo-migration', 'wp-theme', '.claude', '.github', 'assets']);
function allPages() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.name === 'index.html') out.push(path.relative('.', dir));
    }
  })('.');
  return ['', ...out.filter(Boolean).sort()];
}
const pages = args.all ? allPages() : (args.pages ?? '').split(',');
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const modes = MODE === 'both' ? ['phone', 'desktop'] : [MODE];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await webkit.launch();
console.log('WebKit', browser.version());
const contexts = {};
for (const m of modes) {
  contexts[m] = await browser.newContext(m === 'phone'
    ? { ...(devices['iPhone 15'] || { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), locale: 'en-CA' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-CA' });
}

const PAGE_METRICS = `(() => {
  const vw = document.documentElement.clientWidth;
  const overflow = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, bodyScrollWidth: document.body.scrollWidth };
  const clipped = e => { for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true; } return false; };   // an ancestor cuts it off at the screen edge, so it cannot widen the page
  const widest = [...document.querySelectorAll('body *')].map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.right > vw + 1 && x.r.width > 0 && getComputedStyle(x.e).position !== 'fixed' && !clipped(x.e) && !x.e.closest('[class*=marquee], [class*=track], .clients-track, svg, video, .csm-tilt, [hidden], .mega, #services-mega-menu, #mobile-nav')).sort((a, b) => b.r.right - a.r.right).slice(0, 3).map(x => x.e.tagName.toLowerCase() + (x.e.className && typeof x.e.className === 'string' ? '.' + x.e.className.trim().split(/\\s+/)[0] : '') + ' right=' + Math.round(x.r.right));
  const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.currentSrc && getComputedStyle(i).display !== 'none').map(i => i.currentSrc.split('/').slice(-2).join('/'));
  const videos = [...document.querySelectorAll('video')].map(v => ({ src: (v.currentSrc || v.src || '').split('/').pop(), paused: v.paused, ready: v.readyState, err: v.error ? v.error.code : 0, auto: v.hasAttribute('autoplay') }));
  const h1 = document.querySelectorAll('h1').length;
  // visuals that shrank to a sliver: a box with an aspect-ratio (hero photo cards, mockups) that holds a photo or video of at least 300px and is drawn under 100px wide.
  // A WebKit-only sizing bug (percentage widths inside shrink-wrapped flex or grid items) looks like this; small logos have no aspect-ratio and are ignored.
  const natural = e => (e.matches && e.matches('img, video') ? [e] : [...e.querySelectorAll('img, video')]).some(m => (m.naturalWidth || m.videoWidth || Number(m.getAttribute('width')) || 0) >= 300);
  const collapsed = [...document.querySelectorAll('body *')].map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width > 0 && x.r.width < 100 && getComputedStyle(x.e).aspectRatio !== 'auto' && getComputedStyle(x.e).display !== 'none' && getComputedStyle(x.e).position !== 'absolute' && !x.e.closest('[class*=marquee], [class*=track], [hidden], .crv-avatar, [class*=logo]') && natural(x.e)).slice(0, 3).map(x => x.e.tagName.toLowerCase() + (typeof x.e.className === 'string' && x.e.className ? '.' + x.e.className.trim().split(/\\s+/)[0] : '') + ' ' + Math.round(x.r.width) + 'px wide');
  // photos drawn at a different shape than the file (a fixed height next to width:100% does this): more than 6% off, with no object-fit to crop or letterbox them
  const stretched = [...document.images].filter(i => { if (!i.naturalWidth || /\\.svg(\\?|$)/i.test(i.currentSrc)) return false; const r = i.getBoundingClientRect(); if (r.width < 40 || r.height < 40 || getComputedStyle(i).display === 'none') return false; if (!['fill', ''].includes(getComputedStyle(i).objectFit)) return false; const k = (r.width / r.height) / (i.naturalWidth / i.naturalHeight); return k < 0.94 || k > 1.06; }).slice(0, 3).map(i => i.currentSrc.split('/').pop() + ' drawn ' + Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height) + ' from ' + i.naturalWidth + 'x' + i.naturalHeight);
  // logos wider than the card they sit in (the partner wall's Microsoft logo was 188px in a 169px card): an svg or img inside a *logo* box that sticks out of its card
  const cardOf = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (!/card/.test(String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className))) continue; const cs = getComputedStyle(a); if (parseFloat(cs.borderTopWidth) > 0 || !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor)) return a; } return null; };
  const logoClip = [...document.querySelectorAll('[class*=logo] svg, [class*=logo] img, svg[class*=logo], img[class*=logo]')].filter(e => { const card = cardOf(e); if (!card) return false; const a = e.getBoundingClientRect(), b = card.getBoundingClientRect(); return a.width > 0 && (a.left < b.left + 1 || a.right > b.right - 1); }).slice(0, 3).map(e => (cardOf(e).className || '').toString().split(' ')[0] + ': ' + Math.round(e.getBoundingClientRect().width) + 'px logo in a ' + Math.round(cardOf(e).getBoundingClientRect().width) + 'px card');
  return { overflow, widest, broken, videos, h1, collapsed, stretched, logoClip, title: document.title };
})()`;

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
}

async function interact(page, mode) {
  const res = {};
  try {
    if (mode === 'phone') {
      const burger = page.locator('.nav-toggle').first();
      if (await burger.count()) {
        await burger.click({ timeout: 4000 });
        await sleep(450);
        res.phoneMenuOpen = await page.evaluate(() => { const m = document.getElementById('mobile-nav'); return !!m && !m.hidden && getComputedStyle(m).display !== 'none' && document.querySelector('.nav-toggle').getAttribute('aria-expanded') === 'true'; });
        res.phoneMenuLinks = await page.evaluate(() => (document.getElementById('mobile-nav') || { querySelectorAll: () => [] }).querySelectorAll('a').length);
        await page.keyboard.press('Escape'); await sleep(350);
        res.phoneMenuClosed = await page.evaluate(() => { const m = document.getElementById('mobile-nav'); return !m || m.hidden || getComputedStyle(m).display === 'none'; });
      } else res.phoneMenu = 'no burger button';
    } else {
      const trig = page.locator('nav.main a[onclick*="toggleMega"]').first();
      if (await trig.count()) {
        await trig.click({ timeout: 4000 }); await sleep(400);
        res.megaOpen = await page.evaluate(() => { const m = document.getElementById('services-mega-menu'); return !!m && m.classList.contains('open') && m.getBoundingClientRect().height > 100; });
        await page.keyboard.press('Escape'); await sleep(300);
        res.megaClosed = await page.evaluate(() => { const m = document.getElementById('services-mega-menu'); return !m || !m.classList.contains('open'); });
      } else res.mega = 'no Services trigger';
    }
    // first FAQ item, if the page has one
    const faq = page.locator('.faq-item .faq-q, details.faq-item summary, .faq-item > button, .faq-item > summary').first();
    if (await faq.count() && await faq.isVisible()) { await faq.scrollIntoViewIfNeeded(); await faq.click({ timeout: 3000 }); await sleep(350); res.faqOpened = true; }
  } catch (e) { res.interactionError = String(e.message || e).split('\n')[0].slice(0, 120); }
  return res;
}

const rows = []; let bad = 0;
for (const slug of pages) {
  for (const mode of modes) {
    const page = await contexts[mode].newPage();
    const problems = []; const consoleMsgs = [];
    const NOISE = /Button failed to load, iconName|was preloaded using link preload but not used|\[oaiq\]|from accessing a frame with origin/;   // headless WebKit media-control icons, a Wistia preload hint, third-party frames
    page.on('console', m => { const loc = (m.location() || {}).url || ''; if (/^https?:/.test(loc) && !loc.startsWith(BASE)) return;   // from a client's embedded page or another site's script
      if (['error', 'warning'].includes(m.type()) && !NOISE.test(m.text())) consoleMsgs.push(m.type() + ': ' + m.text().slice(0, 160)); });
    page.on('pageerror', e => { const st = String((e && e.stack) || ''); if (/https?:\/\//.test(st) && !st.includes(BASE)) return;   // thrown by another site's script (a client's embedded page)
      if (!NOISE.test(String(e.message || e))) problems.push('uncaught: ' + String(e.message || e).slice(0, 160)); });
    page.on('requestfailed', r => { const u = r.url(); if (/\.(mp4|webm|mov)(\?|$)/.test(u) && /cancel|abort/i.test((r.failure() || {}).errorText || '')) return;   // a paused or unloaded clip
      if (!/googletagmanager|salesiq|zoho|google-analytics|doubleclick|facebook|clarity|linkedin/.test(u)) problems.push('request failed: ' + u.replace(/^https?:\/\/[^/]+/, '').slice(0, 100) + ' ' + (r.failure() || {}).errorText); });
    page.on('response', r => { if (r.status() >= 400) problems.push('HTTP ' + r.status() + ': ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 100)); });
    const name = (slug || 'home').replace(/\//g, '__');
    try {
      await page.goto(`${BASE}/${slug}${slug ? '/' : ''}`, { waitUntil: 'load', timeout: 45000 });
      await sleep(1200);
      await scrollThrough(page);
      const m = await page.evaluate(PAGE_METRICS);
      const it = args.nomenu ? {} : await interact(page, mode);
      if (SHOTS && OUT) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await page.screenshot({ path: `${OUT}/${name}-${mode}.png`, fullPage: FULL }); }
      const over = m.overflow.scrollWidth > m.overflow.clientWidth + 1;
      const startedVideos = m.videos.filter(v => !v.paused).length;
      const vErr = m.videos.filter(v => v.err).map(v => v.src + ':' + v.err);
      const flags = [];
      if (over) flags.push(`OVERFLOW ${m.overflow.scrollWidth}>${m.overflow.clientWidth} ${m.widest.join(' | ')}`);
      if (m.broken.length) flags.push('broken images: ' + m.broken.slice(0, 3).join(', '));
      if (m.collapsed.length) flags.push('COLLAPSED: ' + m.collapsed.join(' | '));
      if (m.stretched.length) flags.push('STRETCHED: ' + m.stretched.join(' | '));
      if (m.logoClip.length) flags.push('LOGO CLIPPED: ' + m.logoClip.join(' | '));
      if (vErr.length) flags.push('video errors: ' + vErr.join(', '));
      if (consoleMsgs.length) flags.push('console: ' + [...new Set(consoleMsgs)].slice(0, 3).join(' || '));
      if (problems.length) flags.push(...[...new Set(problems)].slice(0, 4));
      if (it.phoneMenuOpen === false || it.phoneMenuClosed === false || it.megaOpen === false || it.megaClosed === false || it.interactionError) flags.push('interaction: ' + JSON.stringify(it));
      if (m.h1 !== 1) flags.push(`h1 count ${m.h1}`);
      rows.push({ slug: slug || 'home', mode, flags, videos: m.videos.length, started: startedVideos, interaction: it });
      if (flags.length) bad++;
      console.log(`${flags.length ? 'FLAG' : 'ok  '} ${(slug || 'home').padEnd(48)} ${mode.padEnd(7)} videos ${startedVideos}/${m.videos.length} playing${flags.length ? '\n        ' + flags.join('\n        ') : ''}`);
    } catch (e) { bad++; console.log(`ERR  ${slug || 'home'} ${mode}: ${String(e.message || e).split('\n')[0]}`); }
    await page.close();
  }
}
if (OUT) fs.writeFileSync(`${OUT}/webkit-results.json`, JSON.stringify(rows, null, 1));
console.log(`\n${rows.length} page runs in WebKit ${browser.version()}: ${bad} with something to look at`);
await browser.close();
