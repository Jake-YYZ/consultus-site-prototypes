// Left and right edges of the content in every section of a page, to spot sections that do not line up with their neighbours
// (a hero that starts 32px left of the sections under it, a card row that is wider than the text above it, ...).
// Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_edges.mjs --base=http://localhost:8080 --pages=professional-services-marketing,healthcare --width=1440
// For each section it prints the left edge of its first label, first heading, first paragraph and first card/grid, plus the
// right edge of the widest content box. Edges that differ from the page's most common edge are marked with <<.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const pages = (args.pages || '').split(',').filter(Boolean);
const WIDTH = Number(args.width || 1440);
const PORT = 9333 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { chrome.kill(); } catch {} process.exit(1); });   // killing a run must not leave its Chrome behind
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
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cls = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); return s; };
  const first = (root, sel) => { for (const el of root.querySelectorAll(sel)) { if (vis(el) && !el.closest('nav, footer, [aria-hidden=true]')) return el; } return null; };
  const L = el => el ? Math.round(el.getBoundingClientRect().left) : null;
  const R = el => el ? Math.round(el.getBoundingClientRect().right) : null;
  const out = [];
  const secs = [...document.querySelectorAll('main > section, body > section, body > main > div > section, section')].filter((s, i, a) => a.indexOf(s) === i && vis(s) && !s.closest('footer, nav') && !s.parentElement.closest('section'));
  for (const s of secs) {
    const r = s.getBoundingClientRect(); if (r.height < 40) continue;
    const lbl = first(s, '.eyebrow, .indt-lbl, .section-lbl, .dp-lbl, [class*=kicker], [class*=lbl]');
    const head = first(s, 'h1, h2');
    const para = first(s, ':scope > div > p, :scope p');
    const card = first(s, 'article, .card, [class*=card], [class*=grid] > *, table, img, video');
    out.push({ sec: cls(s), y: Math.round(r.top + scrollY), h: Math.round(r.height), lblL: L(lbl), headL: L(head), headR: R(head), paraL: L(para), paraR: R(para), cardL: L(card), cardR: R(card), card: card ? cls(card) : null, head: head ? head.innerText.trim().slice(0, 34) : null });
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
    await s.ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 600)); })()`);
    const rows = await s.ev(MEASURE);
    const lefts = rows.flatMap(r => [r.lblL, r.headL].filter(v => v !== null));
    const count = {}; lefts.forEach(v => { count[v] = (count[v] || 0) + 1; });
    const modal = Number(Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]);
    console.log(`\n=== ${slug} @${WIDTH}  (most common left edge: ${modal}px)`);
    for (const r of rows) {
      const mark = v => (v !== null && Math.abs(v - modal) > 3 ? ' <<' : '');
      console.log(`  y=${String(r.y).padStart(5)} h=${String(r.h).padStart(5)} ${r.sec.slice(0, 30).padEnd(30)} label ${String(r.lblL).padStart(4)}${mark(r.lblL)}  heading ${String(r.headL).padStart(4)}${mark(r.headL)} (right ${r.headR})  "${r.head || ''}"`);
    }
    ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
  }
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
