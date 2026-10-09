// Scroll-through screenshots: scrolls a page one screen at a time (waiting for scroll reveals and scroll-linked animations to play)
// and saves one viewport screenshot per step, which a full-page capture cannot show (it never scrolls, so scroll-driven blocks stay
// in their "before" state). Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_scroll.mjs --out=DIR --base=https://stg-consultusdigital-staging.kinsta.cloud --pages=case-studies/bookseats --width=1440 [--step=0.85] [--wait=900]
// Files: DIR/<page with / as __>-<width>-scroll-NN.png. Combine them with: python3 tools/qa/make_sheets.py (or any image viewer).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const OUT = args.out, BASE = args.base || 'http://localhost:8080';
const pages = (args.pages ?? '').split(',');
const WIDTH = Number(args.width || 1440), HEIGHT = WIDTH < 768 ? 844 : 900;
const STEP = Number(args.step || 0.85), WAIT = Number(args.wait || 900);
fs.mkdirSync(OUT, { recursive: true });
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
try {
  await ready();
  for (const slug of pages) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
    const s = session(ws); await s.send('Page.enable'); await s.send('Runtime.enable');
    await s.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 768 });
    let loaded; const lp = new Promise(r => { loaded = r; }); s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
    const name = (slug || 'home').replace(/\//g, '__');
    try {
      await s.send('Page.navigate', { url: `${BASE}/${slug}${slug ? '/' : ''}` }); await Promise.race([lp, sleep(40000)]); await sleep(2500);
      let n = 0;
      for (let y = 0; ; y += Math.floor(HEIGHT * STEP)) {
        const H = await s.ev(`document.documentElement.scrollHeight`);
        if (y > H - HEIGHT + 4 && n > 0) { y = Math.max(0, H - HEIGHT); }
        await s.ev(`window.scrollTo(0, ${y})`); await sleep(WAIT);
        const shot = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
        n++; fs.writeFileSync(`${OUT}/${name}-${WIDTH}-scroll-${String(n).padStart(2, '0')}.jpg`, Buffer.from(shot.data, 'base64'));
        if (y >= H - HEIGHT || n > 60) break;
      }
      console.log(`ok ${slug || 'home'} ${WIDTH}px ${n} screens`);
    } catch (e) { console.log(`ERR ${slug}: ${e.message}`); }
    ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
  }
} catch (e) { console.log('ERROR', e.message); } finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
