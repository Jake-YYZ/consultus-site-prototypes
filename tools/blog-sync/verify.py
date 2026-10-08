#!/usr/bin/env python3
"""Check that every staging post is 1:1 with its live counterpart, comparing RENDERED articles.

For each live post it fetches the staging page at the SAME URL path (so a 404 means a URL
mismatch), extracts the article body from both sides, and compares: text, headings, images,
links and embeds. Optionally also checks that every image on the staging pages loads.

Usage: python3 verify.py DATA_DIR [--ids 1,2,3] [--images] [--base URL]
Reads  DATA_DIR/live_posts.json   Writes DATA_DIR/verify_report.json
"""
import concurrent.futures as cf
import html as htmllib
import json
import re
import subprocess
import sys
import unicodedata
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup

STAGING = 'https://stg-consultusdigital-staging.kinsta.cloud'
BODY_TYPES = ('text-editor', 'heading', 'image')


def curl(url, head=False):
    cmd = ['curl', '-sL', '--max-time', '60', '-o', '-', '-w', '\n%{http_code}', url]
    if head:
        cmd = ['curl', '-sIL', '--max-time', '30', '-o', '/dev/null', '-w', '%{http_code}', url]
    r = subprocess.run(cmd, capture_output=True)
    out = r.stdout
    if head:
        return int(out.decode() or 0), b''
    body, _, code = out.rpartition(b'\n')
    return int(code.decode() or 0), body


# ---------- normalisation ----------
def norm_text(t):
    t = htmllib.unescape(t or '')
    t = unicodedata.normalize('NFKC', t)
    t = t.replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"')
    t = t.replace('–', '-').replace('—', '-').replace('…', '...')
    return re.sub(r'\s+', ' ', t).strip().lower()


def tokens(t):
    return re.findall(r"[a-z0-9]+", norm_text(t))


def img_key(src):
    name = unquote(urlparse(src).path.rsplit('/', 1)[-1]).lower()
    name = re.sub(r'-\d+x\d+(?=\.\w+$)', '', name)       # size suffix
    name = re.sub(r'-scaled(-\d+)?(?=\.\w+$)', '', name)  # big-image suffix (and WordPress's duplicate -scaled-1)
    return name


def link_key(href):
    if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
        return None
    u = urlparse(href)
    host = u.netloc.lower().replace('www.', '')
    internal = host in ('', 'consultusdigital.com', 'stg-consultusdigital-staging.kinsta.cloud')
    path = u.path
    if path.startswith('/blog/wp-content/'):
        path = path[len('/blog'):]
    path = re.sub(r'/{2,}', '/', path).rstrip('/') or '/'      # "//contact-us" and "/contact-us" are the same page
    if internal:
        return 'int:' + path.lower()
    return 'ext:' + host + path.rstrip('/').lower() + (('?' + u.query) if u.query else '')


def embed_key(el):
    src = el.get('src', '') if el.name == 'iframe' else ''
    m = re.search(r'youtube(?:-nocookie)?\.com/embed/([\w-]{6,})', src)
    if m:
        return 'youtube:' + m.group(1)
    m = re.search(r'player\.vimeo\.com/video/(\d+)', src)
    if m:
        return 'vimeo:' + m.group(1)
    if el.name == 'blockquote' and 'tiktok-embed' in el.get('class', []):
        return 'tiktok:' + (el.get('data-video-id') or el.get('cite', '').rstrip('/').rsplit('/', 1)[-1].split('?')[0])
    if el.name == 'blockquote' and 'twitter-tweet' in el.get('class', []):
        ids = [a['href'].rstrip('/').rsplit('/', 1)[-1].split('?')[0] for a in el.find_all('a', href=True) if '/status/' in a['href']]
        return 'tweet:' + (ids[-1] if ids else '?')
    if el.name == 'iframe' and src:
        return 'iframe:' + urlparse(src).netloc
    return None


def fingerprint(frag):
    """frag: BeautifulSoup element holding the article body."""
    frag = BeautifulSoup(str(frag), 'lxml')
    for t in frag.find_all(['script', 'style', 'noscript']):
        t.decompose()
    embeds = []
    for el in frag.find_all(['iframe', 'blockquote']):
        k = embed_key(el)
        if k:
            embeds.append(k)
            el.decompose()
    imgs = [img_key(i['src']) for i in frag.find_all('img', src=True)]
    links = sorted({k for a in frag.find_all('a', href=True) for k in [link_key(a['href'])] if k})
    heads = [(h.name, norm_text(h.get_text(' ', strip=True))) for h in frag.find_all(re.compile(r'^h[1-6]$'))]
    text = tokens(frag.get_text(' ', strip=True))
    return {'text': text, 'imgs': sorted(imgs), 'links': links, 'heads': heads, 'embeds': sorted(embeds)}


def live_fp(p):
    soup = BeautifulSoup(p['content']['rendered'], 'lxml')
    top = [w for w in soup.select('[data-widget_type]') if not w.find_parent(attrs={'data-widget_type': True})]
    parts = []
    for w in top:
        t = w['data-widget_type'].split('.')[0]
        if t == 'shortcode':
            break
        if t in BODY_TYPES:
            parts.append(str(w))
    frag = BeautifulSoup('<div>' + ''.join(parts) + '</div>', 'lxml').div
    # Elementor's placeholder heading is not content
    for h in frag.find_all(re.compile(r'^h[1-6]$')):
        if norm_text(h.get_text()) == 'add your heading text here':
            h.decompose()
    return fingerprint(frag)


def live_hero_key(p):
    soup = BeautifulSoup(p['content']['rendered'], 'lxml')
    w = soup.select_one('[data-widget_type^="theme-post-featured-image"] img')
    return img_key(w['src']) if w and w.get('src') else None


def staging_fp(page_html):
    soup = BeautifulSoup(page_html, 'lxml')
    body = soup.select_one('.bl-content')
    return (fingerprint(body) if body else None), soup


def diff_lists(a, b):
    from collections import Counter
    ca, cb = Counter(a), Counter(b)
    return list((ca - cb).elements()), list((cb - ca).elements())   # missing from staging, extra on staging


def compare(live, stg):
    miss_t, extra_t = diff_lists(live['text'], stg['text'])
    miss_i, extra_i = diff_lists(live['imgs'], stg['imgs'])
    miss_l, extra_l = diff_lists(live['links'], stg['links'])
    miss_e, extra_e = diff_lists(live['embeds'], stg['embeds'])
    heads_ok = live['heads'] == stg['heads']
    return {'text_missing': len(miss_t), 'text_extra': len(extra_t),
            'text_missing_sample': ' '.join(miss_t[:25]), 'text_extra_sample': ' '.join(extra_t[:25]),
            'img_missing': miss_i, 'img_extra': extra_i,
            'links_missing': miss_l, 'links_extra': extra_l,
            'embeds_missing': miss_e, 'embeds_extra': extra_e,
            'heads_ok': heads_ok,
            'live_words': len(live['text'])}


def grade(c):
    if (c['text_missing'] == 0 and c['text_extra'] == 0 and not c['img_missing'] and not c['img_extra']
            and not c['links_missing'] and not c['links_extra'] and not c['embeds_missing']
            and not c['embeds_extra'] and c['heads_ok']):
        return 'identical'
    if (c['text_missing'] + c['text_extra'] <= 3 and not c['img_missing'] and not c['embeds_missing']
            and len(c['links_missing']) + len(c['links_extra']) <= 1 and c['heads_ok']):
        return 'minor'
    return 'DIFFERENT'


def main():
    data = sys.argv[1]
    args = sys.argv[2:]
    ids = None
    base = STAGING
    check_imgs = '--images' in args
    if '--ids' in args:
        ids = set(int(x) for x in args[args.index('--ids') + 1].split(','))
    if '--base' in args:
        base = args[args.index('--base') + 1]
    posts = json.load(open(data + '/live_posts.json'))
    if ids:
        posts = [p for p in posts if p['id'] in ids]

    def work(p):
        path = urlparse(p['link']).path
        code, body = curl(base + path)
        if code != 200:
            return p['id'], {'status': 'MISSING_PAGE', 'http': code, 'path': path}
        sfp, soup = staging_fp(body.decode('utf-8', 'replace'))
        if sfp is None:
            return p['id'], {'status': 'NO_BODY', 'http': code, 'path': path}
        c = compare(live_fp(p), sfp)
        hero = soup.select_one('.bl-hero-img img')
        hk = img_key(hero['src']) if hero and hero.get('src') else None
        c['hero_ok'] = (hk == live_hero_key(p))
        c['status'] = grade(c) if c['hero_ok'] else 'DIFFERENT'
        c['path'] = path
        c['hero_img'] = hero['src'] if hero else None
        c['imgs_on_page'] = sorted({i['src'] for i in soup.select('.bl-content img[src]')} | ({hero['src']} if hero else set()))
        return p['id'], c

    with cf.ThreadPoolExecutor(6) as ex:
        results = dict(ex.map(work, posts))

    if check_imgs:
        urls = sorted({u for r in results.values() for u in r.get('imgs_on_page', [])})
        def head(u):
            return u, curl(u if u.startswith('http') else base + u, head=True)[0]
        with cf.ThreadPoolExecutor(8) as ex:
            codes = dict(ex.map(head, urls))
        for r in results.values():
            r['broken_imgs'] = [u for u in r.get('imgs_on_page', []) if codes.get(u) != 200]

    json.dump(results, open(data + '/verify_report.json', 'w'))
    from collections import Counter
    st = Counter(r['status'] for r in results.values())
    print('posts checked:', len(results), '|', dict(st))
    if check_imgs:
        bad = {i: r['broken_imgs'] for i, r in results.items() if r.get('broken_imgs')}
        print('posts with an image that does not load:', len(bad))
    for i, r in sorted(results.items()):
        if r['status'] in ('DIFFERENT', 'MISSING_PAGE', 'NO_BODY'):
            if r['status'] == 'DIFFERENT':
                print('  %s %s | text -%d/+%d | img -%s +%s | links -%d/+%d | embeds -%s +%s | heads %s | hero %s' % (
                    i, r['path'][:60], r['text_missing'], r['text_extra'], r['img_missing'][:2], r['img_extra'][:2],
                    len(r['links_missing']), len(r['links_extra']), r['embeds_missing'], r['embeds_extra'],
                    'ok' if r['heads_ok'] else 'DIFF', 'ok' if r['hero_ok'] else 'WRONG'))
            else:
                print('  %s %s | %s %s' % (i, r['path'][:70], r['status'], r.get('http')))


if __name__ == '__main__':
    main()
