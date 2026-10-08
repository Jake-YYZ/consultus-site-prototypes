function () {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const out = { title: document.title, innerWidth: vw, scrollWidth: de.scrollWidth, overflowX: de.scrollWidth > vw + 1 };
  const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sel = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const chain = el => { const p = []; let e = el; for (let i = 0; i < 4 && e && e !== document.body; i++) { p.push(sel(e)); e = e.parentElement; } return p.join(' < '); };
  const clipped = el => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(o.overflowX)) return true; } return false; };

  // horizontal overflow culprits
  out.overflowers = [];
  if (out.overflowX) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && vis(el) && !clipped(el)) { out.overflowers.push(chain(el) + ' right=' + Math.round(r.right)); if (out.overflowers.length > 8) break; }
    }
  }

  // text: small sizes and contrast
  const parseColor = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = el => {
    let layers = []; let e = el;
    while (e && e.nodeType === 1) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // gradient or image: unknown
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      e = e.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const small = new Map(), contrast = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; let counted = 0;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.trim(); if (!t || t.length < 2) continue;
    const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    if (el.closest('#services-mega-menu, #mobile-nav, [aria-hidden="true"], [hidden]')) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    counted++;
    if (fs < 12) { const k = sel(el) + '|' + fs; if (!small.has(k)) small.set(k, { sel: chain(el), size: fs, text: t.slice(0, 50), n: 0 }); small.get(k).n++; }
    const fg = parseColor(cs.color); const bg = bgOf(el);
    if (fg && bg) {
      const f2 = fg.a < 1 ? over(fg, bg) : fg;
      const L1 = lum(f2), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const bold = parseInt(cs.fontWeight) >= 700; const large = fs >= 24 || (fs >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (ratio < need) { const k = sel(el) + '|' + ratio.toFixed(1); if (!contrast.has(k)) contrast.set(k, { sel: chain(el), ratio: +ratio.toFixed(2), need, size: fs, text: t.slice(0, 50), fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, n: 0 }); contrast.get(k).n++; }
    }
  }
  out.textNodes = counted;
  out.smallText = [...small.values()].sort((a, b) => a.size - b.size).slice(0, 30);
  out.lowContrast = [...contrast.values()].sort((a, b) => a.ratio - b.ratio).slice(0, 40);

  // images
  const imgs = [...document.images]; out.imgCount = imgs.length; out.brokenImgs = []; out.oversize = []; out.blurry = [];
  for (const i of imgs) {
    const r = i.getBoundingClientRect(); const src = (i.currentSrc || i.src || '').replace(location.origin, '');
    if (i.complete && i.naturalWidth === 0 && !src.startsWith('data:')) out.brokenImgs.push(src);
    if (i.naturalWidth && r.width > 80 && vis(i)) {
      if (i.naturalWidth > r.width * 2.4 && i.naturalWidth > 900) out.oversize.push(`${src.split('/').pop()} natural ${i.naturalWidth} shown ${Math.round(r.width)}`);
      if (i.naturalWidth < r.width * 0.85 && !/svg/.test(src)) out.blurry.push(`${src.split('/').pop()} natural ${i.naturalWidth} shown ${Math.round(r.width)}`);
    }
  }
  // videos
  out.videos = [...document.querySelectorAll('video')].map(v => { const r = v.getBoundingClientRect(); return { src: (v.currentSrc || v.src || '').split('/').pop(), paused: v.paused, ready: v.readyState, t: +v.currentTime.toFixed(1), dur: +(v.duration || 0).toFixed(1), loop: v.loop, err: v.error ? v.error.code : null, w: Math.round(r.width), h: Math.round(r.height), poster: !!v.poster }; });

  // hidden content with text
  out.hiddenText = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|SELECT)$/.test(el.tagName)) continue;
    if (el.closest('#services-mega-menu, #mobile-nav, details, [hidden], noscript')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') { const t = (el.textContent || '').trim(); if (t.length > 120) out.hiddenText.push(chain(el) + ' :: ' + t.slice(0, 70)); }
  }
  out.hiddenText = out.hiddenText.slice(0, 10);

  // headings
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => !h.closest('footer, #services-mega-menu, #mobile-nav')).map(h => ({ l: +h.tagName[1], t: (h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70), vis: vis(h) }));

  // tap targets (links/buttons smaller than 24x24 css px)
  out.tinyTargets = [];
  for (const a of document.querySelectorAll('a[href], button, summary, [role=button]')) {
    if (!vis(a) || a.closest('#services-mega-menu, #mobile-nav, footer')) continue;
    const r = a.getBoundingClientRect();
    if ((r.width < 24 || r.height < 24) && !(a.tagName === 'A' && getComputedStyle(a).display === 'inline')) out.tinyTargets.push(chain(a) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 25) + '"');
  }
  out.tinyTargets = out.tinyTargets.slice(0, 12);

  // sections: height and whether content is cut off by a fixed height + overflow hidden
  out.clippedBlocks = [];
  for (const el of document.body.querySelectorAll('section *, main *')) {
    const cs = getComputedStyle(el);
    if (/(hidden|clip)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 6 && el.clientHeight > 60 && !/^(VIDEO|IMG|SVG)$/i.test(el.tagName)) {
      if (el.closest('#services-mega-menu, #mobile-nav, details')) continue;
      out.clippedBlocks.push(chain(el) + ` client=${el.clientHeight} scroll=${el.scrollHeight}`);
    }
  }
  out.clippedBlocks = out.clippedBlocks.slice(0, 10);

  // fonts
  out.fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.style);
  out.fontsFailed = [...document.fonts].filter(f => f.status === 'error').map(f => f.family + ' ' + f.weight);

  // header / nav state
  const nav = document.querySelector('nav.main');
  out.nav = nav ? { h: Math.round(nav.getBoundingClientRect().height), burger: (() => { const b = nav.querySelector('.nav-toggle'); return b ? { display: getComputedStyle(b).display, hidden: b.hidden } : null; })(), links: [...nav.querySelectorAll('.nav-links > a')].filter(vis).length } : null;
  out.footerLinks = document.querySelectorAll('footer a[href]').length;
  return out;
}
