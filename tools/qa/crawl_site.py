#!/usr/bin/env python3
"""Read-only crawl of the site: every page of the two sitemaps (static pages and blog posts), every internal link and image source on
them, no redirects followed. Reports links that contain //, links that point at a URL that only redirects, and links or images that fail.
Internal means the staging host, consultusdigital.com and www.consultusdigital.com (their paths are requested on --base).

    python3 tools/qa/crawl_site.py                                  # staging
    python3 tools/qa/crawl_site.py --base=https://consultusdigital.com   # production after go-live
    (about 2 minutes, 8 parallel requests; it only reads)
"""
import re, sys, json, time, collections, os
import urllib.request, urllib.error, urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://stg-consultusdigital-staging.kinsta.cloud'
for a in sys.argv[1:]:
    if a.startswith('--base='):
        BASE = a.split('=', 1)[1].rstrip('/')
HOSTS = {'stg-consultusdigital-staging.kinsta.cloud', 'consultusdigital.com', 'www.consultusdigital.com'}
UA = {'User-Agent': 'Mozilla/5.0 (compatible; consultus-qa-crawl/1.0)'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def get(url, method='GET', tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA, method=method)
            with opener.open(req, timeout=40) as r:
                body = r.read() if method == 'GET' else b''
                return r.status, r.headers.get('Location'), body
        except urllib.error.HTTPError as e:
            body = e.read() if method == 'GET' else b''
            return e.code, e.headers.get('Location'), body
        except Exception as e:
            time.sleep(1 + i)
            last = str(e)[:80]
    return 0, last, b''


def locs(xml):
    return re.findall(r'<loc>([^<]+)</loc>', xml)


def to_path(u):
    return urllib.parse.urlparse(u).path


status, _, body = get(BASE + '/sitemap-pages.xml')
pages = [BASE + to_path(u) for u in locs(body.decode())]
status, _, body = get(BASE + '/blog/post-sitemap.xml')
posts = [BASE + to_path(u) for u in locs(body.decode())]
pages += posts
extra = ['/blog/', '/blog/page/2/']
print('pages from sitemaps:', len(pages) - len(posts), 'static +', len(posts), 'blog; plus', len(extra), 'extra', flush=True)
pages += [BASE + e for e in extra]


def fetch_page(u):
    st, loc, body = get(u)
    links = []
    if st == 200:
        html = body.decode('utf-8', 'replace')
        # only the body, skip <head> links (canonical etc. point at the production host on purpose)
        i = html.find('<body')
        for m in re.finditer(r'<a\b[^>]*?\bhref=(["\'])(.*?)\1', html[i if i > 0 else 0:], re.S):
            links.append(m.group(2).strip())
        for m in re.finditer(r'<(?:img|source|video)\b[^>]*?\b(?:src|poster)=(["\'])(.*?)\1', html, re.S):
            links.append(m.group(2).strip())
    return u, st, links


results = {}
src_of = collections.defaultdict(set)
double = []
with ThreadPoolExecutor(8) as ex:
    for u, st, links in ex.map(fetch_page, pages):
        results[u] = st
        for h in links:
            if not h or h.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:')):
                continue
            p = urllib.parse.urlparse(h)
            if p.scheme and p.netloc.lower() not in HOSTS:
                continue
            path = p.path or '/'
            if p.netloc == '' and not h.startswith('/'):
                continue  # relative without slash: ignore
            if '//' in path:
                double.append((u, h))
            full = BASE + re.sub(r'/{2,}', '/', path) + (('?' + p.query) if p.query else '')
            src_of[full].add(u)
bad_pages = [(u, s) for u, s in results.items() if s != 200]
print('pages fetched:', len(results), 'non-200 pages:', bad_pages[:10], flush=True)
targets = sorted(src_of)
print('unique internal link targets:', len(targets), flush=True)


def check(t):
    st, loc, _ = get(t, method='HEAD')
    if st in (405, 403, 0):
        st, loc, _ = get(t)
    return t, st, loc


stat = collections.Counter(); red = []; gone = []; err = []
with ThreadPoolExecutor(8) as ex:
    for t, st, loc in ex.map(check, targets):
        stat[st] += 1
        if 300 <= st < 400:
            red.append((t, st, loc))
        elif st >= 400 or st == 0:
            gone.append((t, st))
print('target status counts:', dict(stat))
print('double-slash links in <a href>:', len(double))
for u, h in double[:5]:
    print('   ', u.replace(BASE, ''), '->', h[:100])
print('links pointing at a URL that redirects:', len(red), '(distinct targets), links total', sum(len(src_of[t]) for t, _, _ in red))
for t, st, loc in sorted(red, key=lambda x: -len(src_of[x[0]]))[:25]:
    print('   %d x %s %s -> %s' % (len(src_of[t]), st, t.replace(BASE, ''), (loc or '')[:70].replace(BASE, '')))
print('links pointing at a URL that fails (4xx/5xx):', len(gone))
for t, st in sorted(gone, key=lambda x: -len(src_of[x[0]]))[:40]:
    ex_src = sorted(src_of[t])[:2]
    print('   %s %s  (on %d pages, e.g. %s)' % (st, t.replace(BASE, ''), len(src_of[t]), ', '.join(s.replace(BASE, '') for s in ex_src)))
json.dump({'red': red, 'gone': gone, 'double': double}, open(os.path.join(os.environ.get('TMPDIR', '/tmp'), 'crawl_site_result.json'), 'w'))
print('details saved to', os.path.join(os.environ.get('TMPDIR', '/tmp'), 'crawl_site_result.json'))
