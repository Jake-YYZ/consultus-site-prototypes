// Results page: the larger view for creatives and websites, and the justified rows of the creative portfolio.
//   node tools/qa/qa_results_lb.mjs --base=http://localhost:8080 [--engine=chromium|webkit] [--width=1440]
// Checks: a creative opens (video and image), the arrow keys and the buttons move on, Escape closes and the focus goes back to the
// tile, a website opens with its live link (target _blank, rel noopener), the "Visit site" link on the card does not open the
// viewer, and every row of the creative groups has tiles of one height with 18px between them (no overflow, no ragged bottoms).
import { chromium, webkit } from './webkit/node_modules/playwright/index.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const base = arg('base', 'http://localhost:8080').replace(/\/$/, '');
const engine = arg('engine', 'chromium');
const width = +arg('width', 1440);
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'webkit' ? {} : { channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
const page = await ctx.newPage();
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); console.log((cond ? 'ok   ' : 'FAIL ') + msg); };

await page.goto(`${base}/results/?type=creative`, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));
await page.waitForTimeout(600);

// rows: open every group, then every row must have one height and 18px gaps (12px on phones)
await page.evaluate(() => document.querySelectorAll('.rl-cgroup:not(.rl-open) .rl-more').forEach(b => b.click()));
await page.waitForTimeout(500);
const rows = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.rl-cgroup').forEach(g => {
    if (!g.offsetWidth) return;
    const m = g.querySelector('.rl-mcols'); const mr = m.getBoundingClientRect();
    const byTop = {};
    [...m.children].filter(c => c.offsetWidth).forEach(c => { const r = c.getBoundingClientRect(); const k = Math.round(r.top + scrollY); (byTop[k] = byTop[k] || []).push({ l: r.left, r: r.right, h: Math.round(r.height) }); });
    Object.values(byTop).forEach(a => out.push({ id: g.id, n: a.length, hs: [...new Set(a.map(x => x.h))], gaps: a.slice(1).map((x, i) => Math.round(x.l - a[i].r)), over: Math.round(a[a.length - 1].r - mr.right) }));
  });
  return out;
});
ok(rows.length > 0, `${rows.length} rows measured`);
const wantGap = width <= 640 ? 12 : 18;
for (const r of rows) {
  const sameH = r.hs.length === 1 || Math.max(...r.hs) - Math.min(...r.hs) <= 1;
  if (!sameH || r.gaps.some(g => Math.abs(g - wantGap) > 1) || r.over > 1) ok(false, `row in ${r.id}: heights ${r.hs}, gaps ${r.gaps}, overflow ${r.over}`);
}
ok(!problems.some(p => p.startsWith('row in')), 'all rows: one height, gaps right, no overflow');

// the button no longer touches the tiles
const gapBtn = await page.evaluate(() => {
  const g = document.querySelector('.rl-cgroup.rl-open'); const m = g.querySelector('.rl-mcols'); const b = g.querySelector('.rl-more');
  return Math.round(b.getBoundingClientRect().top - m.getBoundingClientRect().bottom);
});
ok(gapBtn >= 28, `space between the tiles and the button: ${gapBtn}px`);

// larger view: a video creative
const firstVideoCard = page.locator('.rl-cgroup .rl-creative:has(video)').first();
await firstVideoCard.scrollIntoViewIfNeeded();
await firstVideoCard.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
ok(await page.locator('#rl-lb').isVisible(), 'Enter opens the larger view');
ok(await page.locator('#rl-lb-stage video').count() === 1, 'a video creative shows a video with controls');
const hasControls = await page.evaluate(() => document.querySelector('#rl-lb-stage video').controls);
ok(hasControls, 'the video has controls');
const c0 = await page.locator('#rl-lb-count').innerText();
await page.keyboard.press('ArrowRight');
const c1 = await page.locator('#rl-lb-count').innerText();
ok(c0 !== c1, `ArrowRight moves on (${c0} -> ${c1})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
ok(!(await page.locator('#rl-lb').isVisible()), 'Escape closes it');
const focusBack = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('rl-creative'));
ok(focusBack, 'focus goes back to the tile');
const overflowBack = await page.evaluate(() => document.documentElement.style.overflow);
ok(overflowBack === '', 'page scrolling is back');

// an image creative, closed with the button
const imgCard = page.locator('.rl-cgroup .rl-creative:has(img)').first();
await imgCard.scrollIntoViewIfNeeded();
await imgCard.click();
await page.waitForTimeout(300);
ok(await page.locator('#rl-lb-stage img').count() === 1, 'an image creative shows the image');
await page.click('.rl-lb-close');
ok(!(await page.locator('#rl-lb').isVisible()), 'the close button closes it');

// websites
await page.goto(`${base}/results/?type=websites`, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));
const site = page.locator('.rl-site[data-url]').first();
await site.scrollIntoViewIfNeeded();
const cardLink = site.locator('.rl-foot a');
ok(await cardLink.count() === 1, 'the card has a Visit site link');
const popupPromise = ctx.waitForEvent('page', { timeout: 1500 }).catch(() => null);
await cardLink.evaluate(a => a.addEventListener('click', e => e.preventDefault(), { once: true }));   // do not leave the page in the test
await cardLink.click();
await popupPromise;
ok(!(await page.locator('#rl-lb').isVisible()), 'the card link does not open the viewer');
await site.click({ position: { x: 40, y: 80 } });
await page.waitForTimeout(300);
ok(await page.locator('#rl-lb').isVisible(), 'clicking a website opens the larger view');
const visit = await page.evaluate(() => { const a = document.getElementById('rl-lb-visit'); return { hidden: a.hidden, href: a.href, target: a.target, rel: a.rel }; });
ok(!visit.hidden && /^https:\/\//.test(visit.href) && visit.target === '_blank' && /noopener/.test(visit.rel), `Visit live site: ${visit.href} (${visit.target}, ${visit.rel})`);
const noLink = await page.evaluate(() => { const c = [...document.querySelectorAll('.rl-site')].find(x => !x.getAttribute('data-url')); return c ? c.querySelector('.rl-foot b').textContent : null; });
if (noLink) {
  await page.keyboard.press('Escape');
  await page.locator('.rl-site:not([data-url])').first().click({ position: { x: 40, y: 80 } });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('rl-lb-visit').hidden), `${noLink} has no live link (none verified), so the button is hidden`);
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall good');
process.exit(problems.length ? 1 : 0);
