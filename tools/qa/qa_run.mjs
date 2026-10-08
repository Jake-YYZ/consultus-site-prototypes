// Headless-Chrome QA runner (Chrome DevTools Protocol, no npm packages; macOS Chrome path below).
// For each page and width: console errors, failed requests, horizontal overflow, broken images, text under 12px, low
// contrast, videos, hidden text, headings (qa_metrics.js), plus full-page screenshots cut into chunks (--shots=0 skips them).
// usage: node tools/qa/qa_run.mjs --out=DIR --base=http://localhost:8080 --pages=seo,cro --widths=1440,390 [--shots=1] [--chunk=1800]
// Run pages one process at a time: the local python server resets connections under heavy parallel load.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const OUT = args.out, BASE = args.base || 'http://localhost:8080';
const pages = (args.pages || '').split(',').filter(Boolean);
const widths = (args.widths || '1440,390').split(',').map(Number);
const SHOTS = args.shots !== '0';
const CHUNK = Number(args.chunk || 1800);
const PORT = 9333 + Math.floor(Math.random() * 500);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu',
  '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitReady() {
  for (let i = 0; i < 150; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {} await sleep(200); }
  throw new Error('chrome did not start');
}

class Session {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) this.handlers.forEach(h => h(m));
    };
  }
  send(method, params = {}, timeout = 90000) {
    const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, timeout);
    });
  }
  on(h) { this.handlers.push(h); }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
}

async function openTab() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return { s: new Session(ws), id: t.id, ws };
}

const METRICS = fs.readFileSync(new URL('./qa_metrics.js', import.meta.url), 'utf8');

async function runOne(slug, width) {
  const { s, id, ws } = await openTab();
  const mobile = width < 768, height = mobile ? 844 : 900;
  const consoleMsgs = [], failed = [], badStatus = [];
  const reqs = new Map();
  s.on(m => {
    const p = m.params;
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) consoleMsgs.push({ type: p.type, text: p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push({ type: 'exception', text: (p.exceptionDetails.exception?.description || p.exceptionDetails.text || '').slice(0, 300), url: p.exceptionDetails.url, line: p.exceptionDetails.lineNumber });
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level)) consoleMsgs.push({ type: 'log-' + p.entry.level, text: p.entry.text.slice(0, 200), url: p.entry.url });
    if (m.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { url: p.request.url });
    if (m.method === 'Network.responseReceived') { const r = reqs.get(p.requestId); if (r) { r.status = p.response.status; r.type = p.type; r.mime = p.response.mimeType; } if (p.response.status >= 400) badStatus.push({ url: p.response.url, status: p.response.status }); }
    if (m.method === 'Network.loadingFinished') { const r = reqs.get(p.requestId); if (r) r.bytes = (r.bytes || 0) + p.encodedDataLength; }
    if (m.method === 'Network.loadingFailed') { const r = reqs.get(p.requestId); failed.push({ url: r?.url, error: p.errorText, canceled: p.canceled }); }
  });
  for (const d of ['Page', 'Runtime', 'Log', 'Network']) await s.send(d + '.enable');
  await s.send('Network.setCacheDisabled', { cacheDisabled: true });
  await s.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  let loaded; const loadP = new Promise(r => { loaded = r; });
  s.on(m => { if (m.method === 'Page.loadEventFired') loaded(); });
  const url = `${BASE}/${slug === 'home' ? '' : slug + '/'}`;
  await s.send('Page.navigate', { url });
  await Promise.race([loadP, sleep(40000)]);
  await sleep(2500);
  const docH = await s.eval(`(async () => { const h = () => document.documentElement.scrollHeight; for (let y = 0; y < h(); y += Math.floor(innerHeight * 0.7)) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); } window.scrollTo(0, h()); await new Promise(r => setTimeout(r, 700)); window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 900)); return h(); })()`);
  const metrics = await s.eval(`(${METRICS})()`);
  const out = { slug, width, url, docH, metrics, console: consoleMsgs, failed: failed.filter(f => !f.canceled), badStatus };
  let bytes = 0; const byType = {};
  for (const r of reqs.values()) { bytes += r.bytes || 0; const t = r.type || 'other'; byType[t] = (byType[t] || 0) + (r.bytes || 0); }
  out.transferKB = Math.round(bytes / 1024); out.byTypeKB = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)]));
  if (SHOTS) {
    const lm = await s.send('Page.getLayoutMetrics');
    const H = Math.ceil(lm.cssContentSize.height), W = Math.ceil(lm.cssContentSize.width);
    out.shots = [];
    for (let y = 0, i = 1; y < H; y += CHUNK, i++) {
      const h = Math.min(CHUNK, H - y);
      const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: Math.min(W, width), height: h, scale: 1 } });
      const f = `${OUT}/${slug.replace(/\//g, '__')}-${width}-${String(i).padStart(2, '0')}.png`;
      fs.writeFileSync(f, Buffer.from(r.data, 'base64')); out.shots.push(f);
    }
  }
  fs.writeFileSync(`${OUT}/${slug.replace(/\//g, '__')}-${width}.json`, JSON.stringify(out, null, 1));
  ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`).catch(() => {});
  return out;
}

try {
  await waitReady();
  for (const slug of pages) {
    for (const w of widths) {
      try {
        const o = await runOne(slug, w);
        const m = o.metrics;
        console.log(`${slug.padEnd(22)} ${String(w).padEnd(5)} h=${o.docH} overflow=${m.overflowX ? 'YES' : 'no'} console=${o.console.length} failed=${o.failed.length} 4xx=${o.badStatus.length} KB=${o.transferKB} shots=${o.shots?.length ?? 0}`);
      } catch (e) { console.log(`${slug} ${w} ERROR ${e.message}`); }
    }
  }
} finally { chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0); }
