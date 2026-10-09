// Finds content that does not start on the page's content edge: the hero, clients strip or closing band whose text starts
// 32px left of the sections under it (the wrappers are 1200px wide, the sections 1136px of content inside 32px padding).
// Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_bands.mjs --base=http://localhost:8080 --pages=about,careers --width=1440
//        node tools/qa/qa_bands.mjs --all            (every folder with an index.html, from the repo root)
// Add --scroll to scroll through each page first (slower; layout does not depend on it). Add --home to include the homepage
// when using --pages (--all includes it).
// The content edge of a page is the left edge most of its headings and section labels share (the page's own edge: the service
// pages use a wider container than the rest, consistently, and are fine). Every visible heading, paragraph, label, list item and
// button that is not positioned out of the flow is measured; the ones that start 1 to 40px LEFT of that edge are listed,
// grouped by the full-width band they sit in. Section heads (h2 and section labels) that start 1 to 40px RIGHT of the edge are
// listed too ("RIGHT"): a section built on a narrower container than its neighbours. A clean page prints "ok".
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const WIDTH = Number(args.width || 1440);
const SKIP = new Set(['.git', 'node_modules', 'tools', 'docs', 'seo-migration', 'wp-theme', '.claude', '.github', 'assets']);
function allPages() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.name === 'index.html') out.push(path.relative('.', dir));
    }
  })('.');
  return ['', ...out.sort()];
}
const pages = args.all ? allPages() : [...(args.home ? [''] : []), ...(args.pages || '').split(',').filter(Boolean)];
const PORT = 9333 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {} await sleep(200); } throw new Error('no chrome'); }
function session(ws) {
  let id = 0; const pend = new Map(); const handlers = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else if (m.method) handlers.forEach(h => h(m)); };
  return {
    send(method, params = {}) { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => { pend.set(i, { res, rej }); setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('timeout ' + method)); } }, 60000); }); },
    on(h) { handlers.push(h); },
    async ev(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
  };
}
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const sitewide = Math.max(32, Math.round((vw - 1136) / 2));
  const cls = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); return s; };
  const posCache = new Map();
  const outOfFlow = el => {
    if (!el || el === document.body) return false;
    if (posCache.has(el)) return posCache.get(el);
    const cs = getComputedStyle(el);
    let r = cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'absolute' || cs.position === 'fixed' || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden') || (parseFloat(cs.opacity) === 0 && !el.closest('.rv'));
    if (!r && /^(nav|footer)$/i.test(el.tagName)) r = true;
    if (!r && (el.id === 'services-mega-menu' || el.id === 'mobile-nav')) r = true;
    if (!r) r = outOfFlow(el.parentElement);
    posCache.set(el, r); return r;
  };
  const fullBleed = el => { for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { const r = p.getBoundingClientRect(); if (r.width >= vw - 2 && r.height >= 40) return p; } return null; };
  const found = [];
  // the page's own edge: the most common left among its h2 and section labels (hero and band headings are the odd ones out)
  const counts = {};
  for (const el of document.querySelectorAll('h2, .section-lbl, [class*=-lbl], [class*=kicker]')) {
    if (outOfFlow(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    if (!(el.innerText || '').trim()) continue;
    const k = Math.round(r.left); counts[k] = (counts[k] || 0) + 1;
  }
  const edge = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? sitewide);
  const sel = 'h1, h2, h3, h4, p, li, a.btn, button, .eyebrow, .section-lbl, [class*=lbl], [class*=eyebrow], [class*=kicker], blockquote, figcaption, label, dt, dd, summary';
  for (const el of document.querySelectorAll(sel)) {
    if (outOfFlow(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    const text = (el.innerText || '').trim(); if (!text) continue;
    const off = Math.round(r.left) - edge;
    if (off >= -40 && off <= -1) {
      const band = fullBleed(el);
      found.push({ y: Math.round(r.top + scrollY), el: cls(el), off, left: Math.round(r.left), text: text.slice(0, 40).replace(/\\s+/g, ' '), band: band ? cls(band) : '(page)' });
    }
  }
  const right = [];
  for (const el of document.querySelectorAll('h2, .section-lbl, [class*=-lbl], [class*=kicker]')) {
    if (outOfFlow(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    const text = (el.innerText || '').trim(); if (!text) continue;
    const off = Math.round(r.left) - edge;
    if (off >= 1 && off <= 40) { const band = fullBleed(el); right.push({ y: Math.round(r.top + scrollY), el: cls(el), off, left: Math.round(r.left), text: text.slice(0, 40).replace(/\\s+/g, ' '), band: band ? cls(band) : '(page)' }); }
  }
  return { vw, edge, sitewide, found, right };
})()`;
const results = [];
try {
  await ready();
  for (const slug of pages) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
    const s = session(ws); await s.send('Page.enable'); await s.send('Runtime.enable');
    await s.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false });
    let loaded; const lp = new Promise(r => { loaded = r; }); s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
    try {
      await s.send('Page.navigate', { url: `${BASE}/${slug}${slug ? '/' : ''}` }); await Promise.race([lp, sleep(30000)]); await sleep(1100);
      if (args.scroll) await s.ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500)); })()`);
      const res = await s.ev(MEASURE);
      results.push({ slug, ...res });
      if (!res.found.length && !res.right.length) console.log(`ok    ${slug || '(home)'}  (edge ${res.edge}px)`);
      else {
        console.log(`${res.found.length ? 'LEFT ' : 'RIGHT'} ${slug || '(home)'}  (page edge ${res.edge}px, sitewide ${res.sitewide}px @${res.vw})`);
        for (const [label, list] of [['left', res.found], ['right', res.right]]) {
          const groups = new Map();
          for (const f of list) { const k = f.band + ' | offset ' + f.off; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
          for (const [k, arr] of groups) console.log(`        ${label.toUpperCase()} ${k}: ${arr.length} element(s), e.g. ${arr.slice(0, 3).map(f => `${f.el} "${f.text}"`).join(' ; ')}`);
        }
      }
    } catch (e) { console.log(`ERR   ${slug}: ${e.message}`); }
    ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
  }
  const bad = results.filter(r => r.found.length), badR = results.filter(r => r.right.length);
  console.log(`\n${results.length} page(s) at ${WIDTH}px: ${bad.length} with content left of the page edge, ${badR.length} with a section head right of it`);
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
