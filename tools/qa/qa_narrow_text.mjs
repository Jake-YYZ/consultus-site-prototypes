// Finds text blocks that are narrower than the box they sit in (a width cap such as max-width: 720px), so a paragraph under
// a full-width heading stops short of the right edge. Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_narrow_text.mjs --base=http://localhost:8080 --pages=divisions,healthcare --width=1440
// Centered blocks (auto margins or text-align:center) are skipped on purpose; review the rest by eye.
// --heading also lists paragraphs (capped or not) that are clearly narrower than the heading right above them.
// --noscroll skips the scroll through the page (much faster; layout does not depend on lazy images).
// --squeezed=N lists text sitting in a column narrower than N px (run at --width=390: finds two-column blocks that do not stack on a phone).
// --blocks also lists capped containers (FAQ lists, text wrappers, card groups) that stop short of the box they sit in.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const pages = (args.pages || '').split(',').filter(Boolean);
const WIDTH = Number(args.width || 1440);
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
const FIND = `(() => {
  const out = [];
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = el => { let s = el.tagName.toLowerCase(); if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); return s; };
  for (const el of document.querySelectorAll('p, li, blockquote, figcaption')) {
    if (!vis(el) || el.closest('footer, nav, #services-mega-menu, #mobile-nav, details:not([open]) > :not(summary)')) continue;
    const text = (el.innerText || '').trim(); if (text.length < 90) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.textAlign === 'center' || cs.marginLeft === 'auto' || (parseFloat(cs.marginLeft) > 8 && parseFloat(cs.marginRight) > 8 && Math.abs(parseFloat(cs.marginLeft) - parseFloat(cs.marginRight)) < 2)) continue;
    const par = el.parentElement; const pcs = getComputedStyle(par); const pr = par.getBoundingClientRect();
    if (pcs.textAlign === 'center') continue;
    const inner = pr.width - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
    const capped = cs.maxWidth !== 'none';
    const unused = inner - r.width;
    let hw = null; { let pv = el.previousElementSibling; while (pv && !/^H[1-6]$/.test(pv.tagName)) pv = pv.previousElementSibling; if (pv) hw = pv.getBoundingClientRect().width; }
    const narrowerThanHeading = hw !== null && hw - r.width > 100 && r.width < inner * 0.88;
    if ((capped && unused > 60 && r.width < inner * 0.88) || (${args.heading ? 'true' : 'false'} && narrowerThanHeading)) {
      // heading above it (a sibling) that spans wider?
      let prev = el.previousElementSibling; let headW = null;
      while (prev && !/^H[1-6]$/.test(prev.tagName)) prev = prev.previousElementSibling;
      if (prev) headW = Math.round(prev.getBoundingClientRect().width);
      out.push({ el: name(el), parent: name(par), text: text.slice(0, 70), width: Math.round(r.width), room: Math.round(inner), maxWidth: cs.maxWidth, headingWidth: headW, y: Math.round(r.top + scrollY) });
    }
  }
  const squeeze = ${Number(args.squeezed || 0)};
  if (squeeze > 0) {
    // text squeezed into a column narrower than the given width (a two-column block that does not stack on a phone)
    for (const el of document.querySelectorAll('p, li, h1, h2, h3, h4, blockquote, figcaption, summary, span, div')) {
      if (!vis(el) || el.closest('footer, nav, #services-mega-menu, #mobile-nav, .svc-marquee-bar, [aria-hidden=true]')) continue;
      if (el.children.length > 0 && el.tagName !== 'P' && !/^H[1-4]$/.test(el.tagName)) continue;
      const text = (el.innerText || '').trim(); if (text.length < 40 || /\\n/.test(text.slice(0, 40)) && el.tagName === 'DIV') continue;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (cs.display === 'inline') continue;
      if (r.width < squeeze) out.push({ el: 'SQUEEZED ' + name(el), parent: name(el.parentElement), text: text.slice(0, 60).replace(/\\s+/g, ' '), width: Math.round(r.width), room: Math.round(innerWidth), maxWidth: cs.maxWidth, headingWidth: null, y: Math.round(r.top + scrollY) });
    }
  }
  if (${args.blocks ? 'true' : 'false'}) {
    // containers (lists, FAQ blocks, wrappers) that are capped narrower than the box they sit in, with nothing beside them
    for (const el of document.querySelectorAll('div, ul, ol, dl, section, details, table')) {
      if (!vis(el) || el.closest('footer, nav, #services-mega-menu, #mobile-nav, .svc-marquee-bar')) continue;
      const cs = getComputedStyle(el); if (cs.maxWidth === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      if (cs.marginLeft === 'auto' || cs.display === 'inline' || cs.display === 'none') continue;
      const par = el.parentElement; if (!par) continue; const pcs = getComputedStyle(par);
      if (!/^(block|flow-root|list-item)$/.test(pcs.display) || pcs.textAlign === 'center') continue;
      const r = el.getBoundingClientRect(); const pr = par.getBoundingClientRect();
      if (pr.width >= window.innerWidth - 40) continue; // page-level wrappers (a 1200px column inside a full-width section) are meant to be narrower
      const inner = pr.width - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
      const text = (el.innerText || '').trim(); if (text.length < 150 || el.querySelectorAll('p, li, summary, h2, h3, h4').length < 2) continue;
      if (inner - r.width > 120 && r.width < inner * 0.88) out.push({ el: 'BLOCK ' + name(el), parent: name(par), text: text.slice(0, 60).replace(/\s+/g, ' '), width: Math.round(r.width), room: Math.round(inner), maxWidth: cs.maxWidth, headingWidth: null, y: Math.round(r.top + scrollY) });
    }
  }
  return out;
})()`;
try {
  await ready();
  for (const slug of pages) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
    const s = session(ws); await s.send('Page.enable'); await s.send('Runtime.enable');
    await s.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false });
    let loaded; const lp = new Promise(r => { loaded = r; }); s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
    await s.send('Page.navigate', { url: `${BASE}/${slug}/` }); await Promise.race([lp, sleep(30000)]); await sleep(1500);
    if (!args.noscroll) await s.ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); })()`);
    const found = await s.ev(FIND);
    console.log(`\\n=== ${slug} @${WIDTH}: ${found.length} capped text block(s)`);
    for (const f of found) console.log(`  y=${String(f.y).padStart(5)} ${f.el.slice(0, 34).padEnd(34)} width ${String(f.width).padStart(4)} of ${String(f.room).padStart(4)} (max-width ${f.maxWidth}${f.headingWidth ? ', heading above is ' + f.headingWidth : ''})  "${f.text}"`);
    ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
  }
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
