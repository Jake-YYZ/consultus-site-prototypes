// JavaScript smoke test of every page: uncaught exceptions and console errors on load, and that the shared header functions
// (toggleMega, closeMega, setMegaTab) are still defined. Headless Chrome via the DevTools protocol, no npm packages (macOS path).
// usage: node tools/qa/qa_js.mjs --base=http://localhost:8080 --all        (every folder with an index.html, from the repo root)
//        node tools/qa/qa_js.mjs --base=http://localhost:8080 --pages=,about,cro   (an empty name is the homepage)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = args.base || 'http://localhost:8080';
const SKIP = new Set(['.git', 'node_modules', 'tools', 'docs', 'seo-migration', 'wp-theme', '.claude', '.github', 'assets']);
function allPages() { const out = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); } else if (e.name === 'index.html') out.push(path.relative('.', d)); } })('.'); return ['', ...out.sort()]; }
const pages = args.all ? allPages() : (args.pages ?? '').split(',');
const PORT = 9333 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }
let bad = 0, n = 0;
for (const slug of pages) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
  let id = 0; const pend = new Map(); const hs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } else if (m.method) hs.forEach(h => h(m)); };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const errs = [];
  hs.push(m => {
    if (m.method === 'Runtime.exceptionThrown') errs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0].slice(0, 160));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/ERR_CONNECTION_RESET|ERR_SOCKET_NOT_CONNECTED/.test(m.params.entry.text)) errs.push('log: ' + m.params.entry.text.slice(0, 120) + ' ' + (m.params.entry.url || '').slice(-60));
  });
  let loaded; const lp = new Promise(r => { loaded = r; }); hs.push(m => { if (m.method === 'Page.loadEventFired') loaded(); });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/${slug}${slug ? '/' : ''}` }); await Promise.race([lp, sleep(30000)]); await sleep(900);
  const r = await send('Runtime.evaluate', { expression: `({ fns: typeof toggleMega === 'function' && typeof closeMega === 'function' && typeof setMegaTab === 'function', nav: !!document.querySelector('nav.main'), burger: !!document.querySelector('.nav-toggle') })`, returnByValue: true });
  const v = r.result.value; n++;
  const problems = [...errs]; if (!v.fns) problems.push('header functions missing'); if (!v.nav) problems.push('no nav'); if (!v.burger) problems.push('no burger button');
  if (problems.length) { bad++; console.log(`BAD ${slug || '(home)'}: ${problems.join(' | ')}`); }
  ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`).catch(() => {});
}
console.log(`${n} pages checked, ${bad} with a problem`);
chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0);
