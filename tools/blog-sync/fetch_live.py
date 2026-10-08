#!/usr/bin/env python3
"""Pull every published post, category and tag from the live blog (public REST API).

Usage: python3 fetch_live.py OUT_DIR
Writes OUT_DIR/live_posts.json, live_categories.json, live_tags.json.
Uses curl because the system Python's TLS is too old for the live site. Author names are not
public through the API, so build_bodies.py reads them from the rendered post header instead.
"""
import json, os, subprocess, sys

LIVE = 'https://consultusdigital.com'
POST_FIELDS = ('id,slug,link,status,type,title,date,date_gmt,modified,modified_gmt,author,'
               'categories,tags,featured_media,excerpt,content,sticky,format')

def get(url):
    r = subprocess.run(['curl', '-sS', '--fail', '-D', '-', url], capture_output=True)
    if r.returncode:
        raise SystemExit('curl failed for %s: %s' % (url, r.stderr.decode()[:200]))
    head, _, body = r.stdout.partition(b'\r\n\r\n')
    pages = 1
    for line in head.decode('latin1').split('\r\n'):
        if line.lower().startswith('x-wp-totalpages:'):
            pages = int(line.split(':')[1])
    return json.loads(body), pages

def collect(route, fields, extra=''):
    items, page, pages = [], 1, 1
    while page <= pages:
        data, pages = get('%s/wp-json/wp/v2/%s?per_page=100&page=%d&_fields=%s%s' % (LIVE, route, page, fields, extra))
        items += data
        page += 1
    return items

def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    jobs = [('live_posts.json', 'posts', POST_FIELDS, '&status=publish'),
            ('live_categories.json', 'categories', 'id,name,slug,parent,count', ''),
            ('live_tags.json', 'tags', 'id,name,slug,count', '')]
    for fname, route, fields, extra in jobs:
        items = collect(route, fields, extra)
        json.dump(items, open(os.path.join(out, fname), 'w'))
        print(fname, len(items))

if __name__ == '__main__':
    main()
