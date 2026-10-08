#!/usr/bin/env python3
"""Download the live post pages and pull out their SEO head (title, description, canonical, robots,
og:image, schema types, published time).

Usage: python3 fetch_live_pages.py DATA_DIR [--refresh]
Writes DATA_DIR/live_pages/<id>.html (cached) and DATA_DIR/live_heads.json
"""
import concurrent.futures as cf
import html as htmllib
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlparse


def head_info(h):
    def first(pat):
        m = re.search(pat, h, re.S)
        return htmllib.unescape(m.group(1)).strip() if m else None
    return {
        'title': first(r'<title>([^<]*)</title>'),
        'description': first(r'<meta name="description" content="([^"]*)"'),
        'canonical': first(r'<link rel="canonical" href="([^"]*)"'),
        'robots': first(r'<meta name="robots" content="([^"]*)"'),
        'og_image': first(r'<meta property="og:image" content="([^"]*)"'),
        'published': first(r'<meta property="article:published_time" content="([^"]*)"'),
        'schema': sorted(set(re.findall(r'"@type":\s*"([A-Za-z]+)"', h))),
    }


def main():
    data = sys.argv[1]
    refresh = '--refresh' in sys.argv
    os.makedirs(data + '/live_pages', exist_ok=True)
    posts = json.load(open(data + '/live_posts.json'))

    def work(p):
        f = '%s/live_pages/%d.html' % (data, p['id'])
        if refresh or not os.path.exists(f) or os.path.getsize(f) < 5000:
            r = subprocess.run(['curl', '-sL', '--max-time', '90', '-o', f, '-w', '%{http_code}', p['link']], capture_output=True, text=True)
            if r.stdout.strip() != '200':
                return p['id'], {'error': 'http ' + r.stdout.strip()}
        h = open(f, encoding='utf-8', errors='replace').read()
        return p['id'], head_info(h[:h.find('</head>') + 7] if '</head>' in h else h)

    with cf.ThreadPoolExecutor(4) as ex:
        heads = dict(ex.map(work, posts))
    json.dump(heads, open(data + '/live_heads.json', 'w'))
    bad = [i for i, v in heads.items() if 'error' in v or not v.get('title')]
    print('live pages:', len(heads), '| failed or no title:', bad)


if __name__ == '__main__':
    main()
