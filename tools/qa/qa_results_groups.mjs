// Results page, Creative Portfolio: every client group is complete and consistent.
//   node tools/qa/qa_results_groups.mjs --base=http://localhost:8080 [--engine=chromium|webkit] [--width=1440] [--shots=DIR]
// Per group: the "Show all N" button, the "N creatives" label and the chip count agree with the tiles; the chips add up to "All clients";
// each tile's --ar is its real width / height; every image loads (not a broken or tiny file); every video file answers, has the width and
// height its tag says, and the dimensions match --ar; a group opened by its chip shows only itself; the closed state shows four tiles.
import { chromium, webkit } from './webkit/node_modules/playwright/index.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const base = arg('base', 'http://localhost:8080').replace(/\/$/, '');
const engine = arg('engine', 'chromium');
const width = +arg('width', 1440);
const shots = arg('shots', '');
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'webkit' ? {} : { channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
const page = await ctx.newPage();
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); console.log((cond ? 'ok   ' : 'FAIL ') + msg); };
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(wistia|fast\.)/i.test(m.text())) errors.push('console: ' + m.text()); });
const bad = [];
page.on('response', r => { if (r.status() >= 400 && /\/assets\//.test(r.url())) bad.push(r.status() + ' ' + r.url()); });

await page.goto(`${base}/results/?type=creative`, { waitUntil: 'load', timeout: 45000 });
await page.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));

const groups = await page.evaluate(() => [...document.querySelectorAll('.rl-cgroup')].map(g => {
  const id = g.getAttribute('data-client');
  const tiles = [...g.querySelectorAll('.rl-mcols > .rl-creative')];
  const chip = document.querySelector(`.rl-chip[data-client="${id}"]`);
  const btn = g.querySelector('.rl-more');
  return {
    id, n: tiles.length,
    total: btn ? +btn.getAttribute('data-total') : null,
    label: (g.querySelector('.rl-ccount') || {}).textContent,
    chip: chip ? +chip.querySelector('i').textContent : null,
    tiles: tiles.map(t => {
      const v = t.querySelector('video'), im = t.querySelector('img'), el = v || im;
      return { kind: v ? 'video' : 'img', src: el.getAttribute('src'), sound: v ? v.getAttribute('data-sound') : null, w: +el.getAttribute('width'), h: +el.getAttribute('height'), ar: parseFloat(t.style.getPropertyValue('--ar')), alt: im ? im.getAttribute('alt') : null };
    }),
  };
}));
const allChip = await page.evaluate(() => +document.querySelector('.rl-chip[data-client="all"] i').textContent);
ok(groups.length >= 10, `${groups.length} client groups`);
ok(groups.reduce((a, g) => a + g.n, 0) === allChip, `All clients chip (${allChip}) equals the tiles on the page (${groups.reduce((a, g) => a + g.n, 0)})`);

for (const g of groups) {
  ok(g.total === g.n || (g.total === null && g.n <= 4), g.total === null ? `${g.id}: ${g.n} tiles, no "Show all" button needed` : `${g.id}: "Show all ${g.total}" matches ${g.n} tiles`);
  ok(g.label === `${g.n} creatives` || (g.n === 1 && g.label === '1 creative'), `${g.id}: label "${g.label}"`);
  ok(g.chip === g.n, `${g.id}: chip count ${g.chip} matches ${g.n} tiles`);
  for (const t of g.tiles) {
    ok(Math.abs(t.ar - t.w / t.h) < 0.012, `${g.id}: --ar ${t.ar} matches ${t.w}x${t.h} (${t.src})`);
    if (t.kind === 'img') ok(!!t.alt && t.alt.length > 8, `${g.id}: alt text on ${t.src}`);
  }
}

// no ad twice in a group: file names that differ only by the size (1x1, 4x5, 9x16, 4-5 ...) are the same ad in another ratio.
// One tile per ad: the same ad in three sizes reads as a page full of repeats (found Oct 14 2026 on Paint My Condo and ONA).
for (const g of groups) {
  const seen = {};
  for (const t of g.tiles) {
    const k = t.src.split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/-lite$/, '').replace(/[-_]?(1x1|4x5|9x16|1-1|4-5|9-16)(?=$|[-_])/gi, '');
    (seen[k] = seen[k] || []).push(t.src.split('/').pop());
  }
  const dups = Object.entries(seen).filter(([, v]) => v.length > 1);
  ok(dups.length === 0, `${g.id}: no ad appears twice in another size` + (dups.length ? ': ' + JSON.stringify(dups) : ''));
}

// images load, with the pixel size the tag says
const imgs = await page.evaluate(async () => {
  const out = [];
  for (const im of document.querySelectorAll('.rl-cgroup .rl-thumb img')) {
    if (!im.complete) await new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); setTimeout(r, 8000); });
    out.push({ src: im.getAttribute('src'), ok: im.complete && im.naturalWidth > 0, nw: im.naturalWidth, nh: im.naturalHeight, w: +im.getAttribute('width'), h: +im.getAttribute('height') });
  }
  return out;
});
const brokenImgs = imgs.filter(i => !i.ok || i.nw !== i.w || i.nh !== i.h);
ok(brokenImgs.length === 0, `${imgs.length} images load at the size their tags say` + (brokenImgs.length ? ': ' + JSON.stringify(brokenImgs.slice(0, 4)) : ''));

// videos: file answers, real dimensions equal the tag, they have a length
const vids = await page.evaluate(async () => {
  const out = [];
  for (const v of document.querySelectorAll('.rl-cgroup .rl-thumb video')) {
    const src = v.getAttribute('src');
    const r = await fetch(src, { method: 'HEAD' }).catch(() => null);
    const probe = document.createElement('video'); probe.muted = true; probe.preload = 'metadata'; probe.src = src;
    const meta = await new Promise(res => { probe.addEventListener('loadedmetadata', () => res({ w: probe.videoWidth, h: probe.videoHeight, d: probe.duration })); probe.addEventListener('error', () => res(null)); setTimeout(() => res(null), 12000); });
    out.push({ src, status: r && r.status, bytes: r && +r.headers.get('content-length'), tagW: +v.getAttribute('width'), tagH: +v.getAttribute('height'), meta, preload: v.getAttribute('preload'), autoplay: v.hasAttribute('autoplay'), muted: v.muted });
  }
  return out;
});
const badVids = vids.filter(v => v.status !== 200 || !v.meta || v.meta.w !== v.tagW || v.meta.h !== v.tagH || !(v.meta.d > 3) || v.preload !== 'none' || v.autoplay || !v.muted);
ok(badVids.length === 0, `${vids.length} videos: file 200, real size = tag, length > 3 s, preload none, no autoplay, muted` + (badVids.length ? ': ' + JSON.stringify(badVids.slice(0, 3)) : ''));
const heavy = vids.filter(v => v.bytes > 2.5e6);
ok(heavy.length === 0, `no loop over 2.5 MB` + (heavy.length ? ': ' + heavy.map(v => v.src + ' ' + v.bytes).join(', ') : ''));

// Every video ad can be HEARD. The grid tile is a silent preview loop (browsers block autoplay with sound); its larger view plays the file named in
// data-sound with the sound on. Only the carousels (slideshows made from pictures) have no audio. A prospect has to be able to listen to an ad.
const videoTiles = groups.flatMap(g => g.tiles.filter(t => t.kind === 'video').map(t => ({ g: g.id, ...t })));
const silent = videoTiles.filter(t => !t.sound && !/carousel/.test(t.src));
ok(videoTiles.length > 0 && silent.length === 0, `every video ad has a file with sound (${videoTiles.filter(t => t.sound).length} of ${videoTiles.length} video tiles; the rest are carousels)` + (silent.length ? ': silent: ' + silent.map(t => t.src).join(', ') : ''));
const sounds = videoTiles.filter(t => t.sound);
const soundInfo = await page.evaluate(async list => {
  const out = [];
  for (const t of list) {
    const r = await fetch(t.sound, { method: 'HEAD' }).catch(() => null);
    const probe = document.createElement('video'); probe.muted = true; probe.preload = 'metadata'; probe.src = t.sound;
    const meta = await new Promise(res => { probe.addEventListener('loadedmetadata', () => res({ w: probe.videoWidth, h: probe.videoHeight, d: probe.duration })); probe.addEventListener('error', () => res(null)); setTimeout(() => res(null), 15000); });
    out.push({ sound: t.sound, status: r && r.status, meta, w: t.w, h: t.h });
  }
  return out;
}, sounds);
const badSound = soundInfo.filter(f => f.status !== 200 || !f.meta || f.meta.w !== f.w || f.meta.h !== f.h || !(f.meta.d >= 7.5));
ok(sounds.length > 0 && badSound.length === 0, `${sounds.length} files with sound: 200, same size as their tile, at least 7.5 s` + (badSound.length ? ': ' + JSON.stringify(badSound.slice(0, 3)) : ''));
// open each one in the larger view: sound on, no loop, controls, it starts by itself, and (Chrome) audio is really decoded
const soundBad = [];
for (const id of [...new Set(sounds.map(f => f.g))]) {
  await page.click(`.rl-chip[data-client="${id}"]`);
  await page.waitForTimeout(250);
  const cards = page.locator(`#rl-c-${id} .rl-creative:has(video[data-sound])`);
  const n = await cards.count();
  for (let k = 0; k < n; k++) {
    const card = cards.nth(k);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForTimeout(2600);
    const st = await page.evaluate(() => { const v = document.querySelector('#rl-lb-stage video'); return v ? { src: v.getAttribute('src'), muted: v.muted, vol: v.volume, loop: v.loop, paused: v.paused, t: v.currentTime, controls: v.controls, audio: typeof v.webkitAudioDecodedByteCount === 'number' ? v.webkitAudioDecodedByteCount : null } : null; });
    const good = !!st && /-(full|sound)\.mp4$/.test(st.src) && st.muted === false && st.vol > 0 && st.loop === false && st.controls && st.paused === false && st.t > 0.4 && (st.audio === null || st.audio > 0);
    if (!good) soundBad.push(`${id} #${k + 1} ${JSON.stringify(st)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await page.click('.rl-chip[data-client="all"]');
}
ok(soundBad.length === 0, `all ${sounds.length} ads open in the larger view with sound on, no loop, controls, playing by itself` + (engine === 'chromium' ? ', audio decoded' : '') + (soundBad.length ? ': ' + soundBad.slice(0, 3).join(' | ') : ''));
const afterClose = await page.evaluate(() => ({ hidden: document.getElementById('rl-lb').hidden, videos: document.querySelectorAll('#rl-lb-stage video').length }));
ok(afterClose.hidden && afterClose.videos === 0, 'closing the larger view stops and removes the video');

// closed state: four tiles visible per group
const visible = await page.evaluate(() => [...document.querySelectorAll('.rl-cgroup')].map(g => ({ id: g.getAttribute('data-client'), open: g.classList.contains('rl-open'), vis: [...g.querySelectorAll('.rl-mcols > .rl-creative')].filter(t => t.offsetWidth > 0).length, n: g.querySelectorAll('.rl-mcols > .rl-creative').length })));
for (const g of visible) ok(g.open ? g.vis === g.n : g.vis === Math.min(4, g.n), `${g.id}: closed state shows ${g.vis} of ${g.n}`);

// the chip of each new group shows only that group, opened
for (const id of ['paint-my-condo', 'ona']) {
  const has = await page.evaluate(i => !!document.getElementById('rl-c-' + i), id);
  if (!has) continue;
  await page.click(`.rl-chip[data-client="${id}"]`);
  await page.waitForTimeout(300);
  const st = await page.evaluate(i => ({ shown: [...document.querySelectorAll('.rl-cgroup')].filter(g => g.offsetWidth > 0).map(g => g.getAttribute('data-client')), open: document.getElementById('rl-c-' + i).classList.contains('rl-open'), vis: [...document.querySelectorAll('#rl-c-' + i + ' .rl-mcols > .rl-creative')].filter(t => t.offsetWidth > 0).length }), id);
  ok(st.shown.length === 1 && st.shown[0] === id && st.open, `chip ${id}: only that group is shown, opened (${st.vis} tiles)`);
  // wait for the lazy loops in view to start, then check one is really playing
  await page.evaluate(() => window.scrollTo(0, document.getElementById('library').offsetTop));
  await page.waitForTimeout(2500);
  const playing = await page.evaluate(i => [...document.querySelectorAll('#rl-c-' + i + ' video')].filter(v => !v.paused && v.readyState >= 2).length, id);
  ok(playing >= 1, `chip ${id}: ${playing} loops are playing in view`);
  if (shots) await page.screenshot({ path: `${shots}/${id}-${engine}-${width}.png`, fullPage: false });
  // larger view of the last (statics) and of a carousel/video tile
  const opened = await page.evaluate(i => { const vs = [...document.querySelectorAll('#rl-c-' + i + ' .rl-creative:has(video)')]; vs[vs.length - 1].scrollIntoView({ block: 'center' }); vs[vs.length - 1].click(); return !!document.querySelector('#rl-lb-stage video'); }, id);
  await page.waitForTimeout(600);
  const lb = await page.evaluate(() => { const v = document.querySelector('#rl-lb-stage video'); return v ? { controls: v.controls, ready: v.readyState, w: v.width, h: v.height } : null; });
  ok(!!lb && lb.controls, `${id}: a video opens in the larger view with controls ` + JSON.stringify(lb));
  await page.keyboard.press('Escape');
  await page.click('.rl-chip[data-client="all"]');
}
if (shots) { await page.evaluate(() => window.scrollTo(0, 0)); }
ok(bad.length === 0, `no failed asset requests` + (bad.length ? ': ' + bad.slice(0, 4).join(', ') : ''));
ok(errors.length === 0, `no console or page errors` + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall good');
process.exit(problems.length ? 1 : 0);
