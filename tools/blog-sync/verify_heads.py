#!/usr/bin/env python3
"""Compare each post's SEO head (title, description, canonical, robots, og:image, schema types)
between live and staging.

Usage: python3 verify_heads.py DATA_DIR [--base URL]
Reads  DATA_DIR/live_heads.json, live_posts.json   Writes DATA_DIR/heads_report.json
"""
import concurrent.futures as cf
import json
import re
import subprocess
import sys
from urllib.parse import urlparse

from fetch_live_pages import head_info

STAGING = 'https://stg-consultusdigital-staging.kinsta.cloud'


def norm(s):
    s = (s or '').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    s = s.replace('–', '-').replace('—', '-')
    return re.sub(r'\s+', ' ', s).strip()


def pathof(u):
    return urlparse(u or '').path.rstrip('/')


def imgname(u):
    n = re.sub(r'-\d+x\d+(?=\.\w+$)', '', (u or '').rsplit('/', 1)[-1])
    return re.sub(r'-scaled(-\d+)?(?=\.\w+$)', '', n)


def main():
    d = sys.argv[1]
    base = sys.argv[sys.argv.index('--base') + 1] if '--base' in sys.argv else STAGING
    posts = json.load(open(d + '/live_posts.json'))
    live = json.load(open(d + '/live_heads.json'))

    def work(p):
        path = urlparse(p['link']).path
        r = subprocess.run(['curl', '-sL', '--max-time', '60', base + path], capture_output=True)
        h = r.stdout.decode('utf-8', 'replace')
        s = head_info(h[:h.find('</head>') + 7] if '</head>' in h else h)
        l = live[str(p['id'])]
        diffs = {}
        if norm(l['title']) != norm(s['title']):
            diffs['title'] = (l['title'], s['title'])
        if norm(l['description']) != norm(s['description']):
            diffs['description'] = (l['description'], s['description'])
        if pathof(l['canonical']) != pathof(s['canonical']):
            diffs['canonical'] = (l['canonical'], s['canonical'])
        if (l['robots'] or '').replace('follow, index', 'index, follow') != (s['robots'] or '').replace('follow, index', 'index, follow'):
            diffs['robots'] = (l['robots'], s['robots'])
        if imgname(l['og_image']) != imgname(s['og_image']):
            diffs['og_image'] = (l['og_image'], s['og_image'])
        if set(l['schema']) - set(s['schema']):
            diffs['schema_missing'] = sorted(set(l['schema']) - set(s['schema']))
        if (l['published'] or '')[:10] != (s['published'] or '')[:10]:
            diffs['published'] = (l['published'], s['published'])
        return p['id'], diffs

    with cf.ThreadPoolExecutor(6) as ex:
        res = dict(ex.map(work, posts))
    json.dump(res, open(d + '/heads_report.json', 'w'))
    from collections import Counter
    c = Counter(k for v in res.values() for k in v)
    print('posts:', len(res), '| with no head differences:', sum(1 for v in res.values() if not v))
    print('differences by field:', dict(c))
    for k in c:
        ex_ = [(i, v[k]) for i, v in res.items() if k in v][:3]
        for i, v in ex_:
            print('  %s %s: LIVE=%r | STG=%r' % (k, i, str(v[0])[:90], str(v[1])[:90]))


if __name__ == '__main__':
    main()
