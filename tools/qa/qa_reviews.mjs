// Client reviews component (.crv) on every page that carries it: Chrome and Safari's engine (Playwright WebKit), phone and desktop.
// For each page and size it checks: the block is there and has the right number of reviews; the carousel buttons, the counter and the
// arrow keys move one review at a time; the wall shows its first cards and "Show N more reviews" reveals the rest; "Read more" opens and
// closes; nothing sticks out of the block sideways or makes the page scroll sideways; every photo and logo loads and is drawn at its own
// shape (no stretching); no console errors; and, with reduced motion on, the carousel still works.
// The pages come from tools/reviews/reviews.json (blocks that are not "remove"), so this stays in step with the generator.
// usage: node tools/qa/qa_reviews.mjs --base=http://localhost:8080 [--pages=,google-ads,healthcare] [--engine=chromium|webkit|both] [--sizes=phone,desktop]
// (one-time setup is in the header of qa_webkit.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit, devices } from './webkit/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = (args.base || 'http://localhost:8080').replace(/\/$/, '');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'reviews', 'reviews.json'), 'utf8'));
const people = Object.fromEntries(data.people.map(p => [p.id, p]));

// expected pages: [{ page, count, style }]
const expected = [];
for (const [bid, b] of Object.entries(data.blocks)) {
  if (b.style === 'remove') continue;
  const pages = b.pages ? b.pages.map(p => `${p}/index.html`) : [b.page];
  const n = b.style === 'wall' ? { featured: b.featured.length, wall: b.wall.length } : { featured: b.people.length };
  for (const pg of pages) expected.push({ page: pg.replace(/index\.html$/, '').replace(/\/$/, ''), bid, style: b.style, n });
}
const only = typeof args.pages === 'string' ? args.pages.split(',') : null;
const targets = expected.filter(t => !only || only.includes(t.page));
const engines = (args.engine || 'both') === 'both' ? ['chromium', 'webkit'] : [args.engine];
const sizes = (args.sizes || 'phone,desktop').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function launcher(name) { return name === 'webkit' ? webkit : chromium; }
function contextOptions(engine, size) {
  if (size === 'phone') return engine === 'webkit' ? { ...(devices['iPhone 15'] || { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }), locale: 'en-CA' } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-CA' };
  return { viewport: { width: 1440, height: 900 }, locale: 'en-CA' };
}

let bad = 0, runs = 0;
for (const engine of engines) {
  const browser = await launcher(engine).launch(engine === 'chromium' ? { channel: 'chrome' } : {});
  for (const size of sizes) {
    for (const reduced of [false, true]) {
      if (reduced && size !== 'desktop') continue;
      const ctx = await browser.newContext({ ...contextOptions(engine, size), reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await ctx.newPage();
      const problems = [];
      // errors that come from a client's embedded page (BookSeats and others carry trackers inside their iframes) are not ours
      const NOISE = /accessing a frame|snapchat|facebook|clarity|segmetrics|cookieyes|googletagmanager|salesiq|zoho/i;
      page.on('pageerror', e => { if (!NOISE.test(String(e.message || e))) problems.push('uncaught: ' + String(e.message || e).slice(0, 140)); });
      // "Failed to load resource" has no URL: a failure of OUR files is caught by the response handler below (HTTP 4xx on /assets/), the rest comes
      // from a client's embedded page (Gordon's and others answer 403 to headless browsers)
      page.on('console', m => { if (m.type() === 'error' && !/googletagmanager|salesiq|zoho|favicon|Failed to load resource|Beacon API|clarity/i.test(m.text())) problems.push('console: ' + m.text().slice(0, 140)); });
      page.on('response', r => { if (r.status() >= 400 && /\/assets\//.test(r.url())) problems.push(`HTTP ${r.status()}: ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
      for (const t of targets) {
        runs++;
        const issues = [];
        const before = problems.length;
        await page.goto(`${BASE}/${t.page}${t.page ? '/' : ''}`, { waitUntil: 'load', timeout: 45000 });
        await sleep(400);
        const roots = page.locator('.crv');
        const nRoots = await roots.count();
        if (nRoots < 1) { issues.push('no .crv block on the page'); }
        else {
          // the first block is the one this check is about; make its images load now
          await page.evaluate(() => document.querySelectorAll('.crv img').forEach(i => { i.loading = 'eager'; }));
          await roots.first().scrollIntoViewIfNeeded();
          await sleep(900);
          const info = await page.evaluate(() => {
            const root = document.querySelector('.crv');
            const rr = root.getBoundingClientRect();
            const sticking = [...root.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > rr.right + 1.5 || r.left < rr.left - 1.5) && !e.closest('.crv-viewport') && !e.closest('.crv-track'); }).slice(0, 3).map(e => (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right - rr.right) + 'px');
            const imgs = [...document.querySelectorAll('.crv img')];
            const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'));
            const stretched = imgs.filter(i => { if (!i.naturalWidth || !i.offsetParent) return false; const r = i.getBoundingClientRect(); if (r.width < 20) return false; const k = (r.width / r.height) / (i.naturalWidth / i.naturalHeight); return k < 0.95 || k > 1.05; }).map(i => i.getAttribute('src') + ' x' + ((i.getBoundingClientRect().width / i.getBoundingClientRect().height) / (i.naturalWidth / i.naturalHeight)).toFixed(2));
            const noAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
            return { slides: root.querySelectorAll('.crv-viewport .crv-slide').length || root.querySelectorAll('.crv-slide').length, cards: root.querySelectorAll('.crv-card').length, hiddenCards: root.querySelectorAll('.crv-card[hidden]').length, sticking, broken, stretched, noAlt, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, js: root.classList.contains('crv-js') };
          });
          const wantFeatured = t.n.featured;
          if (t.style === 'single-row' || t.style === 'single-center') { if (info.slides !== 1) issues.push(`expected 1 review, found ${info.slides}`); }
          else if (info.slides !== wantFeatured && !args.partial) issues.push(`expected ${wantFeatured} featured reviews, found ${info.slides}`);
          if (t.style === 'wall' && info.cards !== t.n.wall && !args.partial) issues.push(`expected ${t.n.wall} wall cards, found ${info.cards}`);
          if (!info.js && (t.style === 'wall' || t.style === 'featured') && info.slides > 1) issues.push('script did not start (.crv-js missing)');
          if (info.sticking.length) issues.push('sticks out of the block: ' + info.sticking.join(', '));
          if (info.broken.length) issues.push('images not loaded: ' + info.broken.slice(0, 3).join(', '));
          if (info.stretched.length) issues.push('STRETCHED: ' + info.stretched.slice(0, 3).join(', '));
          if (info.noAlt) issues.push(`${info.noAlt} images without an alt attribute`);
          if (info.overflow) issues.push('page scrolls sideways');

          // carousel
          if (info.slides > 1 && t.style !== 'single-row' && t.style !== 'single-center') {
            const vp = roots.first().locator('.crv-viewport');
            const prev = roots.first().locator('.crv-prev'), next = roots.first().locator('.crv-next'), count = roots.first().locator('.crv-count');
            const settle = async () => { let last = -1; for (let i = 0; i < 30; i++) { const x = await vp.evaluate(e => e.scrollLeft); if (x === last) return x; last = x; await sleep(120); } return last; };
            const idx = async () => vp.evaluate(e => Math.round(e.scrollLeft / e.clientWidth));
            const total = info.slides;
            if (!(await prev.isDisabled())) issues.push('previous button is not disabled on the first review');
            if ((await count.textContent()).trim() !== `1 / ${total}`) issues.push('counter does not start at 1 / ' + total);
            await next.click(); await settle();
            if ((await idx()) !== 1) issues.push('next button did not move to review 2 (at ' + (await idx()) + ')');
            if ((await count.textContent()).trim() !== `2 / ${total}`) issues.push('counter did not say 2 / ' + total);
            if (await prev.isDisabled()) issues.push('previous button still disabled on review 2');
            await vp.focus(); await page.keyboard.press('ArrowRight'); await settle();
            if (total > 2 && (await idx()) !== 2) issues.push('ArrowRight did not move to review 3 (at ' + (await idx()) + ')');
            await page.keyboard.press('ArrowLeft'); await settle();
            if ((await idx()) !== 1) issues.push('ArrowLeft did not move back to review 2 (at ' + (await idx()) + ')');
            // the end of the carousel: jump there (clicking through every review one by one is slow) and check its state
            await vp.evaluate((e, n) => e.scrollTo({ left: (n - 1) * e.clientWidth, behavior: 'auto' }), total); await settle();
            if ((await idx()) !== total - 1) issues.push('could not reach the last review (at ' + (await idx()) + ')');
            if (!(await next.isDisabled())) issues.push('next button not disabled on the last review');
            if ((await count.textContent()).trim() !== `${total} / ${total}`) issues.push('counter does not say ' + total + ' / ' + total + ' on the last review');
            await prev.click(); await settle();
            if ((await idx()) !== total - 2) issues.push('previous button did not move back from the last review (at ' + (await idx()) + ')');
            await vp.evaluate(e => e.scrollTo({ left: 0, behavior: 'auto' })); await settle();
            if ((await idx()) !== 0) issues.push('could not return to review 1');
            if (!(await prev.isDisabled())) issues.push('previous button not disabled on the first review');
            if ((await count.textContent()).trim() !== `1 / ${total}`) issues.push('counter does not say 1 / ' + total + ' back on the first review');
          }
          // wall
          if (t.style === 'wall') {
            const wall = roots.first().locator('.crv-card');
            const visible = async () => roots.first().evaluate(r => [...r.querySelectorAll('.crv-card')].filter(c => !c.hidden && c.offsetParent !== null).length);
            const total = await wall.count();
            const first = await visible();
            if (total > 9 && first !== 9) issues.push(`wall shows ${first} cards at first, expected 9`);
            const more = roots.first().locator('.crv-more');
            if (total > 9) {
              await more.scrollIntoViewIfNeeded(); await more.click(); await sleep(300);
              if ((await visible()) !== total) issues.push('"Show more reviews" did not reveal every card');
              if (await roots.first().locator('.crv-more').count()) issues.push('"Show more reviews" button is still there after use');
            }
            const rm = roots.first().locator('.crv-readmore').first();
            if (await rm.count()) {
              await rm.scrollIntoViewIfNeeded(); await rm.click(); await sleep(250);
              if ((await rm.getAttribute('aria-expanded')) !== 'true') issues.push('"Read more" did not open');
              await rm.click(); await sleep(250);
              if ((await rm.getAttribute('aria-expanded')) !== 'false') issues.push('"Read more" did not close');
            }
          }
        }
        const fresh = problems.slice(before);
        issues.push(...fresh);
        const tag = `${engine}/${size}${reduced ? '/reduced-motion' : ''}`;
        if (issues.length) { bad++; console.log(`FAIL ${t.page || 'home'} [${tag}]`); issues.forEach(i => console.log('     ' + i)); }
        else console.log(`ok   ${t.page || 'home'} [${tag}]`);
      }
      await ctx.close();
    }
  }
  await browser.close();
}
console.log(`\n${runs} runs, ${bad ? bad + ' with problems' : 'all clean'}`);
process.exit(bad ? 1 : 0);
