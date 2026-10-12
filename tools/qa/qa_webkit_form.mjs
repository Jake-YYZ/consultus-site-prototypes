// Contact form in the Safari engine (Playwright WebKit): empty submit is refused, a filled one is "sent" and the browser lands on /thank-you/.
// Nothing reaches Zoho: the browser answers the call to crm.zoho.com itself (context.route), so no lead is created.
// usage: node tools/qa/qa_webkit_form.mjs --base=https://stg-consultusdigital-staging.kinsta.cloud
// (one-time setup is in the header of qa_webkit.mjs)
import { webkit, devices } from './webkit/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = (args.base || 'http://localhost:8080').replace(/\/$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await webkit.launch();
let bad = 0;
for (const mode of ['phone', 'desktop']) {
  const ctx = await browser.newContext(mode === 'phone' ? { ...devices['iPhone 15'], locale: 'en-CA' } : { viewport: { width: 1440, height: 900 }, locale: 'en-CA' });
  const sent = [];
  await ctx.route(/crm\.zoho\.com/, async route => { sent.push({ method: route.request().method(), url: route.request().url(), body: route.request().postData() || '' }); await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }); });
  // remember every dataLayer push in sessionStorage: the form leaves the page right after sending, so the page's own copy is gone
  await ctx.addInitScript(() => {
    window.dataLayer = window.dataLayer || [];
    const orig = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function () { try { const a = JSON.parse(sessionStorage.getItem('__dl') || '[]'); a.push(arguments[0]); sessionStorage.setItem('__dl', JSON.stringify(a)); } catch (e) {} return orig.apply(null, arguments); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 140)));
  await page.goto(`${BASE}/contact/?utm_source=qa&utm_medium=test&gclid=QA-TEST`, { waitUntil: 'load', timeout: 45000 });
  await sleep(2400);   // the form refuses to send in its first 2 seconds (spam trap)
  const out = [];
  // 1. empty submit: the browser's own validation stops it, nothing is sent
  await page.click('#contact-zoho-form button[type="submit"]');
  await sleep(500);
  const afterEmpty = { sent: sent.length, formHidden: await page.$eval('#contact-zoho-form', f => f.hidden) };
  out.push(['empty submit sends nothing and keeps the form', afterEmpty.sent === 0 && afterEmpty.formHidden === false]);
  // 2. filled submit
  await page.fill('#ct-first', 'QA');
  await page.fill('#ct-last', 'Safari Test');
  await page.fill('#ct-email', 'qa-safari-test@consultusdigital.com');
  await page.fill('#ct-company', 'QA Safari Test (not sent)');
  await page.selectOption('#ct-revenue', { index: 1 });
  await page.click('#contact-zoho-form button[type="submit"]');
  await page.waitForURL(/\/thank-you\/?$/, { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('load').catch(() => {});
  const done = await page.evaluate(() => ({
    url: location.pathname,
    h1: (document.querySelector('h1') || {}).textContent || '',
    robots: (document.querySelector('meta[name="robots"]') || {}).content || '',
    title: document.title,
    dl: JSON.parse(sessionStorage.getItem('__dl') || '[]').filter(x => x && x.event === 'zoho_form_submit').length,
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
  }));
  out.push(['after sending, the browser is on /thank-you/', /\/thank-you\/?$/.test(done.url)]);
  out.push(['thank-you page says thank you', /thank you/i.test(done.h1)]);
  out.push(['thank-you page is noindex and has its own title and canonical', /noindex/.test(done.robots) && /^Thank You/.test(done.title) && /\/thank-you\/$/.test(done.canonical)]);
  out.push(['dataLayer event zoho_form_submit pushed once', done.dl === 1]);
  const post = sent.find(s => s.method === 'POST');
  const fields = post ? [...new URLSearchParams(post.body).entries()] : [];
  const get = k => (fields.find(([n]) => n === k) || [])[1];
  out.push(['one POST to crm.zoho.com/crm/WebToLeadForm', sent.length === 1 && !!post && /\/crm\/WebToLeadForm$/.test(post.url)]);
  out.push(['Last Name, Email, Company arrived', get('Last Name') === 'Safari Test' && /@/.test(get('Email') || '') && !!get('Company')]);
  out.push(['revenue range arrived (LEADCF32)', !!get('LEADCF32')]);
  out.push(['ad tracking arrived (gclid, utm_source, Lead Source = Google Ads)', get('zc_gad') === 'QA-TEST' && get('LEADCF28') === 'qa' && get('Lead Source') === 'Google Ads']);
  out.push(['page address arrived (LEADCF23)', /\/contact\//.test(get('LEADCF23') || '')]);
  out.push(['no uncaught errors', errors.length === 0]);
  console.log(`--- ${mode}`);
  for (const [name, ok] of out) { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); }
  if (errors.length) console.log('     errors:', errors.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed (nothing was sent to Zoho)');
process.exit(bad ? 1 : 0);
