#!/usr/bin/env python3
"""Static audit of the 18 service pages + /services/ hub (copy rules, SEO tags, JSON-LD, links, images, shared blocks).
Read-only. Usage: python3 tools/qa/audit_static.py [page-folder ...]   (default: the 19 service pages)
Known false positives: links to /blog/ (WordPress, not in this repo), the Services trigger without href, the hidden
mega menu text, <h3> that holds only an image. Needs: pip install beautifulsoup4 lxml"""
import json, os, re, sys, tempfile
from collections import Counter, defaultdict
from urllib.parse import urlparse, unquote
from bs4 import BeautifulSoup, Comment

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAGES = ['google-ads', 'meta-ads', 'microsoft-ads', 'amazon-ads', 'seo', 'local-seo', 'content-marketing', 'aeo-ai-search',
         'influencer-marketing', 'performance-creatives', 'web-development', 'landing-pages', 'cro', 'ab-testing', 'zoho-crm',
         'marketing-automation', 'analytics-attribution', 'sales-enablement', 'services']
if len(sys.argv) > 1:
    PAGES = sys.argv[1:]

SITE = 'https://consultusdigital.com'
findings = defaultdict(list)   # page -> [(severity, category, message)]


def add(page, sev, cat, msg):
    findings[page].append((sev, cat, msg))


def file_for(path):
    """Map a root-relative URL path to a file in the repo, or None."""
    path = unquote(path.split('#')[0].split('?')[0])
    if not path.startswith('/'):
        return None
    p = os.path.join(ROOT, path.lstrip('/'))
    if os.path.isdir(p):
        p = os.path.join(p, 'index.html')
    return p if os.path.isfile(p) else None


def visible_text(soup):
    s = BeautifulSoup(str(soup), 'lxml')
    for t in s(['script', 'style', 'noscript', 'template']):
        t.decompose()
    for c in s.find_all(string=lambda x: isinstance(x, Comment)):
        c.extract()
    for t in s.find_all(['span', 'em', 'strong', 'b', 'i', 'mark', 'small', 'sup', 'sub', 'abbr', 'code']):
        t.unwrap()   # inline markup (the accent <span class="sem">) must not split a sentence into separate words
    s.smooth()
    return s.get_text(' ', strip=True)


BARE = re.compile(r'Consultus(?!\s+Digital)(?![A-Za-z])', re.I)
EM = re.compile('—|&mdash;|&#8212;|&#x2014;')
YEAR = re.compile(r'\b(20(?:1\d|2[0-5]))\b')
LEFTOVER = re.compile(r'(Search intent|Always on|Google Ads formats carousel)', re.I)
all_pages_nav, all_pages_footer = {}, {}
media_totals = {}

for slug in PAGES:
    path = os.path.join(ROOT, slug, 'index.html')
    if not os.path.isfile(path):
        add(slug, 'high', 'file', 'page file missing')
        continue
    raw = open(path, encoding='utf-8').read()
    soup = BeautifulSoup(raw, 'lxml')
    head = soup.head
    url = f'{SITE}/{slug}/'

    # ---------- head / SEO ----------
    title = (soup.title.string or '').strip() if soup.title else ''
    if not title:
        add(slug, 'high', 'seo', 'no <title>')
    else:
        if len(title) > 65: add(slug, 'low', 'seo', f'title is {len(title)} chars: "{title}"')
        if 'Consultus Digital' not in title: add(slug, 'low', 'seo', f'title lacks "Consultus Digital": "{title}"')
        if '#1' in title or EM.search(title): add(slug, 'medium', 'copy', f'title has #1 or em dash: "{title}"')
    md = head.find('meta', attrs={'name': 'description'})
    desc = md['content'].strip() if md and md.get('content') else ''
    if not desc: add(slug, 'high', 'seo', 'no meta description')
    else:
        if len(desc) > 160: add(slug, 'low', 'seo', f'description is {len(desc)} chars')
        if len(desc) < 80: add(slug, 'low', 'seo', f'description is short ({len(desc)} chars)')
        if BARE.search(desc): add(slug, 'medium', 'brand', f'bare "Consultus" in description: {desc}')
        if EM.search(desc): add(slug, 'medium', 'copy', 'em dash in description')
    can = head.find('link', rel='canonical')
    if not can: add(slug, 'high', 'seo', 'no canonical')
    elif can.get('href') != url: add(slug, 'medium', 'seo', f'canonical is {can.get("href")} (expected {url})')
    robots = head.find('meta', attrs={'name': 'robots'})
    if robots and 'noindex' in (robots.get('content') or '').lower(): add(slug, 'high', 'seo', f'robots: {robots.get("content")}')
    og = {m.get('property'): m.get('content') for m in head.find_all('meta') if (m.get('property') or '').startswith('og:')}
    tw = {m.get('name'): m.get('content') for m in head.find_all('meta') if (m.get('name') or '').startswith('twitter:')}
    for k in ('og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name'):
        if not og.get(k): add(slug, 'medium', 'seo', f'missing {k}')
    for k in ('twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'):
        if not tw.get(k): add(slug, 'low', 'seo', f'missing {k}')
    if og.get('og:url') and og['og:url'] != url: add(slug, 'medium', 'seo', f'og:url {og["og:url"]}')
    if og.get('og:image') and not og['og:image'].endswith('og-share.jpg'): add(slug, 'low', 'seo', f'og:image is {og["og:image"]}')
    if og.get('og:title') and og['og:title'] != title: add(slug, 'low', 'seo', f'og:title differs from title: "{og["og:title"]}"')
    if og.get('og:description') and desc and og['og:description'] != desc: add(slug, 'low', 'seo', 'og:description differs from meta description')
    if not soup.html.get('lang'): add(slug, 'medium', 'a11y', 'no lang on <html>')
    if not head.find('meta', attrs={'name': 'viewport'}): add(slug, 'high', 'seo', 'no viewport meta')
    h1s = soup.find_all('h1')
    if len(h1s) != 1: add(slug, 'medium', 'seo', f'{len(h1s)} <h1> elements')

    # ---------- JSON-LD ----------
    ld = []
    for sc in soup.find_all('script', type='application/ld+json'):
        try:
            ld.append(json.loads(sc.string))
        except Exception as e:
            add(slug, 'high', 'schema', f'JSON-LD does not parse: {e}')
    types = []
    for block in ld:
        for node in (block.get('@graph', [block]) if isinstance(block, dict) else block):
            t = node.get('@type'); types += (t if isinstance(t, list) else [t])
            if node.get('@type') == 'FAQPage':
                qs = [q.get('name', '').strip() for q in node.get('mainEntity', [])]
                body_text = re.sub(r'\s+', ' ', visible_text(soup))
                for q in qs:
                    qn = re.sub(r'\s+', ' ', q)
                    if qn not in body_text:
                        add(slug, 'medium', 'schema', f'FAQ question not found verbatim on the page: "{qn[:90]}"')
                add(slug, 'info', 'schema', f'FAQPage with {len(qs)} questions')
            if node.get('@type') in ('Service', 'ProfessionalService'):
                for k in ('name', 'provider', 'areaServed', 'description'):
                    if not node.get(k): add(slug, 'low', 'schema', f'{node.get("@type")} lacks {k}')
            for k, v in node.items():
                s = json.dumps(v)
                if BARE.search(s): add(slug, 'medium', 'brand', f'bare "Consultus" in JSON-LD {k}')
                if EM.search(s) or '—' in s: add(slug, 'medium', 'copy', f'em dash in JSON-LD {k}')
    add(slug, 'info', 'schema', 'JSON-LD types: ' + ', '.join(str(t) for t in types))

    # ---------- visible text rules ----------
    vt = visible_text(soup.body)
    for m in BARE.finditer(vt):
        ctx = vt[max(0, m.start() - 40):m.end() + 40]
        add(slug, 'medium', 'brand', f'bare "Consultus": ...{ctx}...')
    attrs_text = ' | '.join(f'{a}={el.get(a)}' for el in soup.body.find_all(True) for a in ('alt', 'aria-label', 'title', 'placeholder') if el.get(a))
    for m in BARE.finditer(attrs_text):
        add(slug, 'medium', 'brand', f'bare "Consultus" in attribute: ...{attrs_text[max(0, m.start() - 40):m.end() + 40]}...')
    for m in EM.finditer(vt):
        add(slug, 'medium', 'copy', f'em dash: ...{vt[max(0, m.start() - 40):m.end() + 40]}...')
    for m in EM.finditer(attrs_text):
        add(slug, 'medium', 'copy', f'em dash in attribute: ...{attrs_text[max(0, m.start() - 40):m.end() + 40]}...')
    for m in re.finditer(r'free\s+(account\s+)?audit', vt, re.I):
        add(slug, 'medium', 'copy', f'"free audit": ...{vt[max(0, m.start() - 40):m.end() + 40]}...')
    for m in re.finditer(r'(#1|number one|no\.\s*1)\b', vt, re.I):
        add(slug, 'low', 'copy', f'#1 claim: ...{vt[max(0, m.start() - 50):m.end() + 50]}...')
    for m in YEAR.finditer(vt):
        add(slug, 'low', 'copy', f'year {m.group(1)}: ...{vt[max(0, m.start() - 50):m.end() + 40]}...')
    for m in re.finditer(r'lorem|TODO|TBD|placeholder|\[PROTOTYPE|coming soon|XXX|illustrative example|drop (team )?photo', vt, re.I):
        add(slug, 'medium', 'copy', f'placeholder-like text: ...{vt[max(0, m.start() - 40):m.end() + 40]}...')
    for m in re.finditer(r'\b(\w+)\s+\1\b', vt, re.I):
        w = m.group(1).lower()
        if w not in ('that', 'had', 'very') and not w.isdigit() and len(w) > 2:
            add(slug, 'low', 'copy', f'repeated word "{m.group(0)}": ...{vt[max(0, m.start() - 30):m.end() + 30]}...')
    for m in re.finditer(r'\s[,.;:!?]|[?.]{2,}[A-Za-z]|[a-z]\?\.|\bTThe\b|\bfeefee\b|\bformatsh\b|\byourCRO\b', vt):
        add(slug, 'low', 'typo', f'odd punctuation/typo: ...{vt[max(0, m.start() - 30):m.end() + 30]}...')
    for el in soup.body.find_all(['script', 'style']):
        pass
    for sc in soup.body.find_all('script'):
        if sc.string and BARE.search(sc.string) and 'application/ld+json' not in (sc.get('type') or ''):
            for m in BARE.finditer(sc.string):
                add(slug, 'low', 'brand', f'bare "Consultus" in script: ...{sc.string[max(0, m.start() - 30):m.end() + 30].strip()}...')
    if LEFTOVER.search(vt + ' ' + attrs_text):
        add(slug, 'medium', 'copy', f'Google Ads template leftover: {LEFTOVER.search(vt + " " + attrs_text).group(0)}')
    if slug != 'google-ads':
        for el in soup.body.find_all(True):
            for a in ('alt', 'aria-label'):
                v = el.get(a) or ''
                if re.search(r'google ads|google search|search intent', v, re.I) and slug not in ('google-ads', 'services'):
                    add(slug, 'low', 'a11y', f'{a} mentions Google: "{v[:90]}" ({el.name})')

    # ---------- links ----------
    ids = {el.get('id') for el in soup.find_all(id=True)}
    dup_ids = [k for k, v in Counter(el.get('id') for el in soup.find_all(id=True)).items() if v > 1]
    if dup_ids: add(slug, 'medium', 'a11y', f'duplicate ids: {dup_ids[:6]}')
    ext = Counter()
    internal = Counter()
    for a in soup.find_all('a'):
        href = (a.get('href') or '').strip()
        label = a.get_text(' ', strip=True) or a.get('aria-label') or (a.find('img') or {}).get('alt') or ''
        if not href: add(slug, 'medium', 'link', f'<a> without href: "{label[:50]}"'); continue
        if href in ('#', 'javascript:void(0)') or href.startswith('javascript:'):
            add(slug, 'low', 'link', f'dead link href="{href}": "{label[:50]}"'); continue
        if not label.strip(): add(slug, 'medium', 'a11y', f'link with no accessible name: {href}')
        if href.startswith('#'):
            if href[1:] not in ids: add(slug, 'medium', 'link', f'anchor {href} has no target: "{label[:40]}"')
            continue
        if href.startswith(('mailto:', 'tel:')):
            internal[href] += 1; continue
        pu = urlparse(href)
        if pu.scheme in ('http', 'https') and pu.netloc not in ('consultusdigital.com', 'www.consultusdigital.com'):
            ext[pu.netloc] += 1
            if a.get('target') == '_blank' and 'noopener' not in (a.get('rel') or []):
                add(slug, 'low', 'link', f'target=_blank without rel=noopener: {href[:70]}')
            continue
        p = pu.path if pu.scheme else href
        if pu.scheme in ('http', 'https'):
            add(slug, 'low', 'link', f'absolute link to own domain: {href}')
        if p.startswith('/'):
            if not file_for(p) and not file_for(p.rstrip('/') + '/'):
                add(slug, 'high', 'link', f'broken internal link {href}: "{label[:50]}"')
            else:
                internal[p] += 1
        else:
            add(slug, 'low', 'link', f'relative link {href}')
        if pu.fragment:
            tgt = file_for(p)
            if tgt and tgt.endswith('.html'):
                tsoup = open(tgt, encoding='utf-8').read()
                if f'id="{pu.fragment}"' not in tsoup: add(slug, 'medium', 'link', f'{href}: target page has no id "{pu.fragment}"')
    add(slug, 'info', 'link', f'{sum(internal.values())} internal links, external hosts: {dict(ext)}')

    # ---------- media ----------
    seen = set(); weight = 0; big = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or ''
        alt = img.get('alt')
        if alt is None: add(slug, 'medium', 'a11y', f'<img> without alt attribute: {src[:70]}')
        elif not alt.strip() and not (img.get('role') == 'presentation' or img.get('aria-hidden') == 'true') and img.find_parent('a') is not None and not (img.find_parent('a').get_text(strip=True)):
            add(slug, 'medium', 'a11y', f'linked image with empty alt: {src[:70]}')
        if not (img.get('width') and img.get('height')): add(slug, 'low', 'perf', f'<img> without width/height: {src[:70]}')
        if not src: add(slug, 'medium', 'media', '<img> without src'); continue
        if src.startswith('data:') or src.startswith('http'): continue
        f = file_for(src)
        if not f: add(slug, 'high', 'media', f'missing image file {src}'); continue
        if src in seen: continue
        seen.add(src)
        sz = os.path.getsize(f); weight += sz
        if sz > 250 * 1024: big.append((sz, src))
        if img.get('loading') != 'lazy' and img.get('fetchpriority') != 'high':
            add(slug, 'info', 'perf', f'eager image {os.path.basename(src)} ({sz // 1024} KB)')
        if (alt or '') and len(alt) > 140: add(slug, 'low', 'a11y', f'long alt ({len(alt)}): {alt[:60]}...')
    for v in soup.find_all('video'):
        srcs = [v.get('src')] + [s.get('src') for s in v.find_all('source')]
        for s_ in [x for x in srcs if x]:
            f = file_for(s_)
            if not f: add(slug, 'high', 'media', f'missing video file {s_}'); continue
            if s_ in seen: continue
            seen.add(s_); sz = os.path.getsize(f); weight += sz
            big.append((sz, s_))
            add(slug, 'info', 'media', f'video {os.path.basename(s_)} {sz // 1024} KB preload={v.get("preload")} autoplay={v.has_attr("autoplay")} loop={v.has_attr("loop")} poster={bool(v.get("poster"))}')
        pst = v.get('poster')
        if pst:
            f = file_for(pst)
            if not f: add(slug, 'high', 'media', f'missing poster {pst}')
            elif pst not in seen: seen.add(pst); weight += os.path.getsize(f)
        if not v.get('aria-label') and not v.get('aria-hidden'): add(slug, 'low', 'a11y', f'<video> without aria-label/aria-hidden ({(srcs[0] or "")[-40:]})')
    for sty in soup.find_all(style=True):
        for m in re.finditer(r'url\(([^)]+)\)', sty['style']):
            u = m.group(1).strip('\'" ')
            if u.startswith('/') and not file_for(u): add(slug, 'high', 'media', f'missing background image {u}')
    media_totals[slug] = weight
    add(slug, 'info', 'perf', f'media files referenced in HTML: {weight / 1024 / 1024:.1f} MB; largest: ' + ', '.join(f'{os.path.basename(n)} {s // 1024}KB' for s, n in sorted(big, reverse=True)[:4]))

    # ---------- structure ----------
    prev = 0; heads = []
    for h in soup.body.find_all(re.compile(r'^h[1-6]$')):
        lvl = int(h.name[1]); txt = h.get_text(' ', strip=True)
        heads.append((lvl, txt))
        if not txt: add(slug, 'medium', 'a11y', f'empty <{h.name}>')
        if prev and lvl > prev + 1: add(slug, 'low', 'a11y', f'heading level jumps h{prev} -> h{lvl}: "{txt[:50]}"')
        prev = lvl
    main = soup.find('main')
    if not main: add(slug, 'low', 'a11y', 'no <main>')
    for b in soup.find_all('button'):
        if not (b.get_text(strip=True) or b.get('aria-label') or b.get('title')):
            add(slug, 'medium', 'a11y', f'button without a name: {str(b)[:90]}')
    hidden_text = []
    for el in soup.body.find_all(True):
        st = (el.get('style') or '').replace(' ', '').lower()
        if 'display:none' in st or el.has_attr('hidden'):
            t = el.get_text(' ', strip=True)
            if len(t) > 150 and not (el.get('id') or '').startswith('mobile-nav'):
                hidden_text.append((el.name, el.get('id'), t[:80]))
    for h_ in hidden_text:
        add(slug, 'medium', 'hidden', f'hidden block with text: <{h_[0]} id={h_[1]}> "{h_[2]}..."')

    # ---------- shared blocks ----------
    nav = soup.find('nav', class_='main')
    foot = soup.find('footer')
    def norm(el):
        if el is None: return ''
        s = re.sub(r'\s+', ' ', str(el))
        s = re.sub(r'aria-current="[^"]*"', '', s)
        s = re.sub(r'\bis-current\b|\bactive\b', '', s)
        return s
    all_pages_nav[slug] = norm(nav); all_pages_footer[slug] = norm(foot)
    for needle, name in (('GTM-MGSZK8WC', 'GTM'), ('mobile-nav.js', 'mobile-nav.js'), ('salesiq', 'Zoho SalesIQ')):
        if needle not in raw: add(slug, 'high', 'shared', f'{name} missing')
    if 'class="nav-toggle"' not in raw: add(slug, 'high', 'shared', 'burger button missing')
    add(slug, 'info', 'outline', ' > '.join(f'h{l}:{t[:38]}' for l, t in heads[:14]))
    add(slug, 'info', 'size', f'html {len(raw) // 1024} KB, {len(vt.split())} words')

# nav/footer consistency
for kind, store in (('nav', all_pages_nav), ('footer', all_pages_footer)):
    counts = Counter(store.values())
    if len(counts) > 1:
        common = counts.most_common(1)[0][0]
        for s, v in store.items():
            if v != common: add(s, 'medium', 'shared', f'{kind} differs from the majority of the audited pages')

order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
tot = Counter()
for slug in PAGES:
    fs = sorted(findings[slug], key=lambda x: order[x[0]])
    c = Counter(f[0] for f in fs); tot.update(c)
    print(f'\n===== {slug}  (high {c["high"]}, medium {c["medium"]}, low {c["low"]})')
    shown = Counter()
    for sev, cat, msg in fs:
        key = (sev, cat)
        shown[key] += 1
        if sev == 'info' or shown[key] <= 12:
            print(f'  [{sev:6}] {cat:7} {msg[:230]}')
        elif shown[key] == 13:
            print(f'  [{sev:6}] {cat:7} ... more of the same')
print('\nTOTAL', dict(tot))
out_dir = os.path.join(tempfile.gettempdir(), 'consultus-qa'); os.makedirs(out_dir, exist_ok=True)
json.dump({k: v for k, v in findings.items()}, open(os.path.join(out_dir, 'static_findings.json'), 'w'), indent=1)
print('findings saved to', os.path.join(out_dir, 'static_findings.json'))
