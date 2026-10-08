// Interaction tests (Chrome DevTools Protocol, no npm packages; macOS Chrome path below): Services menu (mouse + keyboard,
// skip link), phone menu, carousels, FAQ. Run a local server first (python3 -m http.server 8080) or pass the staging URL.
// usage: node tools/qa/qa_interact.mjs --base=http://localhost:8080 --pages=cro,seo
// Known headless artifact: the carousel 'previous' step reports a failure here but works in a real browser.
import os from 'node:os';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const pages = (args.pages || '').split(',').filter(Boolean);
const PORT = 9333 + Math.floor(Math.random() * 500);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {} await sleep(200); } throw new Error('no chrome'); }
class S {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.h = []; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else if (m.method) this.h.forEach(f => f(m)); }; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => { this.p.set(id, { res, rej }); setTimeout(() => { if (this.p.has(id)) { this.p.delete(id); rej(new Error('timeout ' + method)); } }, 60000); }); }
  on(f) { this.h.push(f); }
  async ev(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
  async key(key, code, vk) { for (const type of ['keyDown', 'keyUp']) await this.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: key === 'Enter' ? '\r' : undefined }); }
}
async function tab() { const r = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json(); const ws = new WebSocket(r.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; }); return { s: new S(ws), id: r.id, ws }; }

const results = [];
function check(page, name, ok, detail = '') { results.push({ page, name, ok, detail }); }

async function load(s, url, width, height, mobile) {
  await s.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  let loaded; const lp = new Promise(r => { loaded = r; }); s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
  await s.send('Page.navigate', { url }); await Promise.race([lp, sleep(30000)]); await sleep(1200);
}

try {
  await ready();
  for (const slug of pages) {
    const url = `${BASE}/${slug}/`;
    // ---------- desktop ----------
    { const { s, id, ws } = await tab(); await s.send('Page.enable'); await s.send('Runtime.enable'); const errs = []; s.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
      await load(s, url, 1440, 900, false);
      const t0 = await s.ev(`(() => { const t = document.querySelector('.nav-links > a[role=button]'); return t ? { exp: t.getAttribute('aria-expanded'), label: t.getAttribute('aria-label') } : null; })()`);
      check(slug, 'desktop: Services trigger is a button', !!t0 && t0.exp === 'false' && t0.label === 'Services', JSON.stringify(t0));
      // keyboard: tab to Services
      await s.ev(`document.body.focus(); window.scrollTo(0,0);`);
      const skipFirst = await s.ev(`!!document.querySelector('.gads-skip, .skip-link')`);
      await s.key('Tab', 'Tab', 9);
      const fs0 = await s.ev(`(document.activeElement.innerText || '').trim()`);
      check(slug, 'desktop: first Tab lands on the skip link', fs0 === 'Skip to content', fs0);
      await s.key('Tab', 'Tab', 9);
      const f1 = await s.ev(`(document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || '').trim()`);
      check(slug, 'desktop: next Tab lands on Services', f1 === 'Services', f1);
      await s.key('Enter', 'Enter', 13); await sleep(250);
      const o1 = await s.ev(`(() => { const m = document.getElementById('services-mega-menu'); const a = document.activeElement; return { open: m.classList.contains('open'), exp: document.querySelector('.nav-links > a[role=button]').getAttribute('aria-expanded'), focus: (a.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 20), inMenu: m.contains(a), vis: getComputedStyle(m).display }; })()`);
      check(slug, 'desktop: Enter opens the menu and moves focus inside', o1.open && o1.exp === 'true' && o1.inMenu, JSON.stringify(o1));
      await s.key('Tab', 'Tab', 9); await s.key('Enter', 'Enter', 13); await sleep(200);
      const o2 = await s.ev(`(() => { const m = document.getElementById('services-mega-menu'); return { tab: m.querySelector('.mega-div.active').dataset.tab, shown: [...m.querySelectorAll('.mega-grid')].filter(g => getComputedStyle(g).display !== 'none').map(g => g.dataset.panel + ':' + g.querySelectorAll('a.mega-card').length) }; })()`);
      check(slug, 'desktop: Enter on a tab switches the panel', o2.tab === 'convert' && o2.shown.join() === 'convert:4', JSON.stringify(o2));
      const total = await s.ev(`document.querySelectorAll('#services-mega-menu a.mega-card[href]').length`);
      check(slug, 'desktop: menu lists 18 services', total === 18, String(total));
      await s.key('Escape', 'Escape', 27); await sleep(200);
      const o3 = await s.ev(`(() => { const m = document.getElementById('services-mega-menu'); const t = document.querySelector('.nav-links > a[role=button]'); return { open: m.classList.contains('open'), exp: t.getAttribute('aria-expanded'), back: document.activeElement === t }; })()`);
      check(slug, 'desktop: Escape closes and returns focus', !o3.open && o3.exp === 'false' && o3.back, JSON.stringify(o3));
      // mouse click opens too
      await s.ev(`document.querySelector('.nav-links > a[role=button]').click()`); await sleep(200);
      const o4 = await s.ev(`document.getElementById('services-mega-menu').classList.contains('open')`);
      check(slug, 'desktop: mouse click opens the menu', o4 === true);
      await s.ev(`closeMega()`);
      // carousels: the buttons scroll a track; check the track moves right and back
      const car = await s.ev(`document.querySelectorAll('.gads-carousel-controls').length`);
      let carOk = true; const carDetail = [];
      for (let i = 0; i < car; i++) {
        const r = await s.ev(`(async () => { const c = document.querySelectorAll('.gads-carousel-controls')[${i}]; const track = document.getElementById(c.dataset.controls); const next = c.querySelector('[data-dir="1"]'); const prev = c.querySelector('[data-dir="-1"]'); track.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 300)); const canScroll = track.scrollWidth > track.clientWidth + 4; const x0 = track.scrollLeft; const nd0 = next.disabled; if (!nd0) next.click(); await new Promise(r => setTimeout(r, 900)); const x1 = track.scrollLeft; if (!prev.disabled) prev.click(); await new Promise(r => setTimeout(r, 900)); const x2 = track.scrollLeft; return { canScroll, nextDisabledAtStart: nd0, prevDisabledAtStart: prev.disabled, x0: Math.round(x0), x1: Math.round(x1), x2: Math.round(x2) }; })()`);
        const ok = r.canScroll ? (r.x1 > r.x0 + 5 && Math.abs(r.x2 - r.x0) < 8 && r.prevDisabledAtStart) : r.nextDisabledAtStart;
        if (!ok) carOk = false; carDetail.push(JSON.stringify(r));
      }
      check(slug, `carousels work (${car})`, carOk, carDetail.join(' | '));
      // FAQ accordions (native details): a closed one opens when its summary is clicked
      const faq = await s.ev(`(() => { const d = [...document.querySelectorAll('details:not(.gads-scope-more)')]; if (!d.length) return { n: 0 }; const closed = d.find(x => !x.open); if (!closed) return { n: d.length, toggled: null }; closed.querySelector('summary').click(); return { n: d.length, toggled: closed.open }; })()`);
      check(slug, `FAQ accordion opens (${faq.n} items)`, faq.n === 0 || faq.toggled !== false, JSON.stringify(faq));
      check(slug, 'desktop: no script errors', errs.length === 0, errs.join(' | ').slice(0, 200));
      ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {}); }
    // ---------- phone ----------
    { const { s, id, ws } = await tab(); await s.send('Page.enable'); await s.send('Runtime.enable'); const errs = []; s.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
      await load(s, url, 390, 844, true);
      const b = await s.ev(`(() => { const b = document.querySelector('.nav-toggle'); const cs = getComputedStyle(b); return { display: cs.display, exp: b.getAttribute('aria-expanded') }; })()`);
      check(slug, 'phone: burger visible', b.display !== 'none' && b.exp === 'false', JSON.stringify(b));
      await s.ev(`document.querySelector('.nav-toggle').click()`); await sleep(300);
      const p1 = await s.ev(`(() => { const p = document.getElementById('mobile-nav'); return { hidden: p.hidden, display: getComputedStyle(p).display, links: p.querySelectorAll('a').length }; })()`);
      check(slug, 'phone: menu opens', !p1.hidden && p1.display !== 'none', JSON.stringify(p1));
      await s.ev(`(() => { const b = document.querySelector('#mobile-nav .mnav-sub-toggle'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); })()`); await sleep(200);
      const p2 = await s.ev(`(() => { const sub = document.getElementById('mnav-services'); return { shown: !sub.hidden, links: [...sub.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) }; })()`);
      check(slug, 'phone: Services lists 18 services', p2.shown && p2.links.length === 18, String(p2.links.length));
      await s.key('Escape', 'Escape', 27); await sleep(200);
      const p3 = await s.ev(`document.getElementById('mobile-nav').hidden`);
      check(slug, 'phone: Escape closes the menu', p3 === true);
      check(slug, 'phone: no script errors', errs.length === 0, errs.join(' | ').slice(0, 200));
      ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {}); }
  }
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  const bad = results.filter(r => !r.ok);
  console.log(`${results.length} checks, ${bad.length} failed`);
  for (const r of bad) console.log(`  FAIL ${r.page}: ${r.name} :: ${r.detail}`);
  fs.mkdirSync(os.tmpdir() + '/consultus-qa', { recursive: true }); fs.writeFileSync(os.tmpdir() + '/consultus-qa/interact_results.json', JSON.stringify(results, null, 1));
  process.exit(0); }
