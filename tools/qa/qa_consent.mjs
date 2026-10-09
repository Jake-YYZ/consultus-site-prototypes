// End-to-end test of assets/consent.js with Chrome DevTools: tag requests are intercepted (never sent) and the production host check is patched on the fly.
// usage: node tools/qa/qa_consent.mjs [BASE_URL, default http://localhost:8080] [screenshot path prefix]   (banner shown once, decline / accept / footer link / 12-month expiry / keyboard order / phone size)
// The page is served as usual; only /assets/consent.js is answered from the local file with the host check switched to "true", so the load of Google Tag Manager and the chat widget can be seen (those requests are answered with an empty script and never leave the machine).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = process.argv[3];
const PORT = 9333 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync('/tmp/qa-chrome-');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--mute-audio', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { chrome.kill(); } catch {} process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(200); }
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; });
let id = 0; const pend = new Map(); const hs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } else if (m.method) hs.forEach(h => h(m)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.value;
let seen = [];
hs.push(async m => {
  if (m.method !== 'Fetch.requestPaused') return;
  const u = m.params.request.url; const rid = m.params.requestId;
  if (/googletagmanager\.com|salesiq\.zohopublic\.com/.test(u)) { seen.push(u); await send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: '' }); }
  else if (/\/assets\/consent\.js/.test(u)) {
    let body = fs.readFileSync(new URL('../../assets/consent.js', import.meta.url), 'utf8');
    body = body.replace("var PROD = /(^|\\.)consultusdigital\\.com$/.test(location.hostname);", 'var PROD = true;');
    await send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(body).toString('base64') });
  } else await send('Fetch.continueRequest', { requestId: rid });
});
await send('Page.enable'); await send('Runtime.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*googletagmanager.com*' }, { urlPattern: '*salesiq.zohopublic.com*' }, { urlPattern: '*/assets/consent.js*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const load = async url => { seen = []; let l; const p = new Promise(r => { l = r; }); const h = m => { if (m.method === 'Page.loadEventFired') l(); }; hs.push(h); await send('Page.navigate', { url }); await Promise.race([p, sleep(20000)]); await sleep(900); hs.splice(hs.indexOf(h), 1); };
const bannerVisible = () => ev(`(() => { const b = document.getElementById('cd-consent'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; })()`);
const state = () => ev(`(() => { try { const r = JSON.parse(localStorage.getItem('cd-consent')); return r && r.v; } catch (e) { return 'err'; } })()`);
const gtm = () => seen.some(u => /googletagmanager\.com\/gtm\.js\?id=GTM-MGSZK8WC/.test(u)), chat = () => seen.some(u => /salesiq\.zohopublic\.com\/widget/.test(u));

await load(BASE + '/');
check('first visit: banner shown', await bannerVisible());
check('first visit: no tag requests before a choice', !gtm() && !chat(), JSON.stringify(seen));
check('banner sits after the skip link in the DOM', await ev(`document.querySelector('.skip-link').nextElementSibling.id === 'cd-consent'`));
if (OUT) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + '-desktop.png', Buffer.from(s.data, 'base64')); }
// keyboard: first Tab goes to the skip link, then into the banner
await ev(`document.activeElement && document.activeElement.blur()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
const f1 = await ev(`document.activeElement.className`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
const f2 = await ev(`document.activeElement.textContent`);
check('keyboard: skip link first, then the banner (link, then buttons)', f1 === 'skip-link' && f2 === 'Privacy policy', `${f1} / ${f2}`);
// decline
await ev(`document.querySelector('#cd-consent .cd-no').click()`); await sleep(300);
check('decline: banner closes, choice stored as denied', !(await bannerVisible()) && (await state()) === 'denied');
await load(BASE + '/cro/');
check('after decline: no banner on the next page, no tags', !(await bannerVisible()) && !gtm() && !chat(), JSON.stringify(seen));
// reopen from the footer and accept
check('footer has a Cookie settings link', await ev(`!!document.querySelector('footer [data-cookie-settings]')`));
await ev(`document.querySelector('footer [data-cookie-settings]').click()`); await sleep(300);
check('footer link reopens the banner', await bannerVisible());
await ev(`document.querySelector('#cd-consent .cd-yes').click()`); await sleep(1200);
check('accept: banner closes, stored as granted, tags requested', !(await bannerVisible()) && (await state()) === 'granted' && gtm() && chat(), JSON.stringify(seen.map(u => u.slice(0, 70))));
await load(BASE + '/about/');
check('granted visitor: no banner, tags load on the next page', !(await bannerVisible()) && gtm() && chat());
// switch off again: the page reloads and the tags are gone
seen = [];
await ev(`document.querySelector('footer [data-cookie-settings]').click()`); await sleep(300);
const navDone = new Promise(r => { const h = m => { if (m.method === 'Page.loadEventFired') { hs.splice(hs.indexOf(h), 1); r(); } }; hs.push(h); });
await ev(`document.querySelector('#cd-consent .cd-no').click()`); await Promise.race([navDone, sleep(8000)]); await sleep(900);
check('granted then declined: page reloads without tags, stored as denied', (await state()) === 'denied' && !gtm() && !chat() && !(await bannerVisible()), JSON.stringify(seen));
// expiry
await ev(`localStorage.setItem('cd-consent', JSON.stringify({ v: 'granted', t: Date.now() - 366 * 24 * 3600 * 1000 }))`);
await load(BASE + '/');
check('choice older than 12 months: banner asks again, no tags', (await bannerVisible()) && !gtm() && !chat());
// phone layout screenshot
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await ev(`localStorage.clear()`); await load(BASE + '/');
if (OUT) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + '-phone.png', Buffer.from(s.data, 'base64')); }
const rect = await ev(`(() => { const r = document.getElementById('cd-consent').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.bottom), innerWidth, innerHeight]; })()`);
check('phone: banner inside the screen', rect[0] >= 0 && rect[1] <= rect[3] && rect[2] <= rect[4], JSON.stringify(rect));
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
chrome.kill(); try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} process.exit(0);
