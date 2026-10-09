// First-load weight and layout stability of pages: bytes transferred by type, number of requests (and video requests), the largest
// contentful paint and the cumulative layout shift, in a phone-sized window (default) with the cache off and no scrolling.
// Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_perf.mjs --base=https://stg-consultusdigital-staging.kinsta.cloud --pages=,cro,case-studies/bookseats --width=390 [--wait=4000] [--scroll] [--list]
// An empty page name is the homepage. --scroll scrolls to the bottom first (what a reader who goes through the whole page downloads).
// --list also prints the heaviest requests of each page.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const pages = (args.pages ?? '').split(',');
const WIDTH = Number(args.width || 390), HEIGHT = WIDTH < 768 ? 844 : 900;
const WAIT = Number(args.wait || 4000);
const PORT = 9333 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return; } catch {} await sleep(200); } throw new Error('no chrome'); }
function session(ws) {
  let id = 0; const pend = new Map(); const hs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else if (m.method) hs.forEach(h => h(m)); };
  return {
    send(method, params = {}) { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => { pend.set(i, { res, rej }); setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('timeout ' + method)); } }, 90000); }); },
    on(h) { hs.push(h); },
    async ev(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
  };
}
const OBSERVE = `(() => { window.__lcp = 0; window.__cls = 0;
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
})()`;
const rows = [];
try {
  await ready();
  for (const slug of pages) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
    const s = session(ws);
    const reqs = new Map();
    s.on(m => {
      const p = m.params;
      if (m.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { url: p.request.url, type: p.type });
      if (m.method === 'Network.responseReceived') { const r = reqs.get(p.requestId); if (r) { r.status = p.response.status; r.type = p.type; r.mime = p.response.mimeType; } }
      if (m.method === 'Network.dataReceived') { const r = reqs.get(p.requestId); if (r) r.bytes = (r.bytes || 0) + p.encodedDataLength; }
      if (m.method === 'Network.loadingFinished') { const r = reqs.get(p.requestId); if (r && p.encodedDataLength) r.bytes = Math.max(r.bytes || 0, p.encodedDataLength); }
    });
    for (const d of ['Page', 'Runtime', 'Network']) await s.send(d + '.enable');
    await s.send('Network.setCacheDisabled', { cacheDisabled: true });
    await s.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: WIDTH < 768 });
    await s.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
    let loaded; const lp = new Promise(r => { loaded = r; }); s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
    try {
      await s.send('Page.navigate', { url: `${BASE}/${slug}${slug ? '/' : ''}` }); await Promise.race([lp, sleep(40000)]); await sleep(WAIT);
      if (args.scroll) { await s.ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 140)); } await new Promise(r => setTimeout(r, 1500)); })()`); }
      const m = await s.ev(`({ lcp: window.__lcp, cls: +window.__cls.toFixed(3), docH: document.documentElement.scrollHeight })`);
      let total = 0; const by = {}; let media = 0, mediaBytes = 0;
      for (const r of reqs.values()) { const b = r.bytes || 0; total += b; by[r.type || 'other'] = (by[r.type || 'other'] || 0) + b; if (r.type === 'Media' || /^video\//.test(r.mime || '')) { media++; mediaBytes += b; } }
      const kb = n => Math.round(n / 1024);
      const row = { page: slug || 'home', width: WIDTH, totalKB: kb(total), mediaKB: kb(mediaBytes), mediaReqs: media, imgKB: kb(by.Image || 0), scriptKB: kb(by.Script || 0), cssKB: kb(by.Stylesheet || 0), fontKB: kb(by.Font || 0), requests: reqs.size, lcp: m.lcp, cls: m.cls };
      rows.push(row);
      if (args.list) { const top = [...reqs.values()].filter(r => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 8); for (const r of top) console.log(`      ${String(kb(r.bytes)).padStart(6)} KB  ${(r.type || '').padEnd(10)} ${r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 110)}`); }
      console.log(`${row.page.padEnd(40)} ${String(row.width).padStart(4)}px  total ${String(row.totalKB).padStart(6)} KB  video ${String(row.mediaKB).padStart(6)} KB (${row.mediaReqs} req)  img ${String(row.imgKB).padStart(5)}  js ${String(row.scriptKB).padStart(4)}  css ${String(row.cssKB).padStart(4)}  font ${String(row.fontKB).padStart(4)}  reqs ${String(row.requests).padStart(3)}  LCP ${String(row.lcp).padStart(5)} ms  CLS ${row.cls}`);
    } catch (e) { console.log(`ERR ${slug}: ${e.message}`); }
    ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
  }
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
