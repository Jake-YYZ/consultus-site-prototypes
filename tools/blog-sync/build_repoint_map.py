#!/usr/bin/env python3
"""Build the "old path -> final path" map that server/repoint_redirects.php uses.

Reads  <repo>/_redirects                                   (exact 301/302 rules; "prefix/*" and 410 rules are skipped)
       wp-theme/consultus-blog/functions.php               (cb_blog_redirects(): the 2023 AI post and the 30 merged posts)
Writes tools/blog-sync/server/repoint_map.json             (keys: lowercase path without trailing slash)

Usage: python3 tools/blog-sync/build_repoint_map.py
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'blog-sync', 'server', 'repoint_map.json')

mapping = {}
for line in open(os.path.join(ROOT, '_redirects'), encoding='utf-8'):
    if not line.startswith('/'):
        continue
    old, new, status = line.split()
    if status in ('301', '302') and not old.endswith('/*'):
        mapping[old.lower().rstrip('/')] = new

theme = open(os.path.join(ROOT, 'wp-theme', 'consultus-blog', 'functions.php'), encoding='utf-8').read()
body = theme[theme.index('function cb_blog_redirects()'):theme.index('function cb_site_url(')]
for old, new in re.findall(r"'(/blog/[^']+/)'\s*=>\s*'(/[^']+/)'", body):
    mapping[old.lower().rstrip('/')] = new

# a final page must not itself be an old URL (no chains)
chains = [k for k, v in mapping.items() if v.lower().rstrip('/') in mapping]
if chains:
    raise SystemExit('chains in the map: %s' % chains)
json.dump(mapping, open(OUT, 'w', encoding='utf-8'), indent=1, sort_keys=True)
print('%d old paths -> %s' % (len(mapping), os.path.relpath(OUT, ROOT)))
