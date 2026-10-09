// Layout differences between Safari's engine (Playwright WebKit) and Chrome: total page height and the height of every top-level block.
// A block that is much taller or shorter in one engine (a hero photo that shrank to a sliver, a grid that wraps differently) shows up here
// even when nothing logs an error. Small differences are normal (fonts are drawn slightly differently), so only large ones are listed.
// usage: node tools/qa/qa_engine_diff.mjs --base=http://localhost:8080 --pages=,cro,about --mode=both
//        node tools/qa/qa_engine_diff.mjs --base=http://localhost:8080 --all --mode=phone
// Options: --mode=phone|desktop|both (default both; phone = 393 px wide, desktop = 1440 px)   --pct=3 (page height difference to list, default 3)
// Chrome here is the installed Google Chrome (Playwright channel "chrome"); WebKit needs the one-time setup in the header of qa_webkit.mjs.
// Run it against a local server (python3 -m http.server 8080): both engines load the same files.
import fs from 'node:fs';
import path from 'node:path';
import { webkit, chromium } from './webkit/node_modules/playwright/index.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const BASE = (args.base || 'http://localhost:8080').replace(/\/$/, '');
const MODE = args.mode || 'both';
const PCT = Number(args.pct || 3);
const SKIP = new Set(['.git', 'node_modules', 'tools', 'docs', 'seo-migration', 'wp-theme', '.claude', '.github', 'assets']);
function allPages() { const out = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); } else if (e.name === 'index.html') out.push(path.relative('.', d)); } })('.'); return ['', ...out.filter(Boolean).sort()]; }   // the walk also finds the root index.html (empty name): keep the homepage once
const pages = args.all ? allPages() : (args.pages ?? '').split(',');
const modes = MODE === 'both' ? ['phone', 'desktop'] : [MODE];
const VIEW = { phone: { width: 393, height: 852 }, desktop: { width: 1440, height: 900 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// top-level blocks (children of body and of main) with their heights
const BLOCKS = `(() => {
  const kids = [...document.body.children];
  const main = document.querySelector('main'); if (main) kids.push(...main.children);
  return {
    total: document.documentElement.scrollHeight,
    blocks: kids.filter(e => !/^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(e.tagName) && getComputedStyle(e).display !== 'none' && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).position !== 'absolute')
      .map(e => ({ k: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/)[0] : ''), h: Math.round(e.getBoundingClientRect().height) }))
  };
})()`;

async function measure(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await sleep(900);
  await page.evaluate(async () => {   // scroll through so lazy images and scroll reveals settle, then back to the top
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
  return page.evaluate(BLOCKS);
}

const chrome = await chromium.launch({ channel: 'chrome' });
const wk = await webkit.launch();
let flagged = 0, runs = 0;
for (const mode of modes) {
  const ctxs = [await chrome.newContext({ viewport: VIEW[mode], deviceScaleFactor: 1 }), await wk.newContext({ viewport: VIEW[mode], deviceScaleFactor: 1 })];
  const pg = [await ctxs[0].newPage(), await ctxs[1].newPage()];
  for (const slug of pages) {
    const url = `${BASE}/${slug}${slug ? '/' : ''}`;
    try {
      const [c, w] = [await measure(pg[0], url), await measure(pg[1], url)];
      runs++;
      const d = w.total - c.total, pct = Math.abs(d) / c.total * 100;
      const diffs = [];
      if (c.blocks.length === w.blocks.length) {
        c.blocks.forEach((b, i) => { const dh = w.blocks[i].h - b.h; if (Math.abs(dh) > 40 && Math.abs(dh) / Math.max(b.h, 1) > 0.1) diffs.push(`${b.k} ${b.h}->${w.blocks[i].h}px`); });
      } else diffs.push(`different number of blocks (${c.blocks.length} Chrome, ${w.blocks.length} WebKit)`);
      const flag = pct > PCT || diffs.length;
      if (flag) flagged++;
      console.log(`${flag ? 'DIFF' : 'ok  '} ${(slug || 'home').padEnd(52)} ${mode.padEnd(7)} height Chrome ${c.total} WebKit ${w.total} (${d >= 0 ? '+' : ''}${d}px, ${pct.toFixed(1)}%)${diffs.length ? '\n        ' + diffs.slice(0, 5).join('\n        ') : ''}`);
    } catch (e) { flagged++; console.log(`ERR  ${slug || 'home'} ${mode}: ${String(e.message || e).split('\n')[0]}`); }
  }
  await Promise.all(ctxs.map(c => c.close()));
}
await chrome.close(); await wk.close();
console.log(`\n${runs} page runs compared: ${flagged} with a height difference over ${PCT}% or a block that differs by more than 10% and 40px`);
