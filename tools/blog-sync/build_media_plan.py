#!/usr/bin/env python3
"""List the media-library records staging needs (featured images and images used inside posts).

Usage: python3 build_media_plan.py DATA_DIR
Reads  DATA_DIR/bodies.json   Writes DATA_DIR/media_plan.json
Each entry: {id, rel, alt, parent, featured_for}. `rel` is the path under wp-content/uploads;
the server script trims size suffixes (-300x200) to find the original file.
"""
import json, re, sys
from urllib.parse import unquote

REF = re.compile(r'wp-content/uploads/([^"\'\s)<>?#]+)')

def rel(url):
    m = REF.search(url or '')
    return unquote(m.group(1)) if m else None

def main():
    data = sys.argv[1]
    bodies = json.load(open(data + '/bodies.json'))
    plan = {}
    for b in bodies:
        f = b.get('featured')
        if f and rel(f['src']):
            plan[f['id']] = {'id': f['id'], 'rel': rel(f['src']), 'alt': f.get('alt', ''), 'parent': b['id'], 'featured_for': b['id']}
        for im in b['content_images']:
            if im['id'] and rel(im['src']) and im['id'] not in plan:
                plan[im['id']] = {'id': im['id'], 'rel': rel(im['src']), 'alt': im.get('alt', ''), 'parent': b['id'], 'featured_for': None}
    out = sorted(plan.values(), key=lambda x: x['id'])
    json.dump(out, open(data + '/media_plan.json', 'w'))
    print('attachments referenced by live posts:', len(out), '| featured:', sum(1 for x in out if x['featured_for']))

if __name__ == '__main__':
    main()
