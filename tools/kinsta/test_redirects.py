#!/usr/bin/env python3
"""Test every redirect in _redirects against a running site, plus a few must-not-break pages.

Usage: python3 tools/kinsta/test_redirects.py [BASE_URL]      (default: the Kinsta staging URL)
For each rule it checks: the old URL answers 301 with the right Location; the new page answers 200.
For a sample of rules it also checks the no-trailing-slash, UPPER-CASE and ?utm query-string variants.
"""
import concurrent.futures as cf
import os
import subprocess
import sys
from urllib.parse import urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://stg-consultusdigital-staging.kinsta.cloud').rstrip('/')


def probe(url):
    r = subprocess.run(['curl', '-s', '-o', '/dev/null', '--max-time', '40', '-w', '%{http_code} %{redirect_url}', url],
                       capture_output=True, text=True)
    code, _, loc = r.stdout.partition(' ')
    return int(code or 0), loc.strip()


def path_query(u):
    p = urlparse(u)
    return p.path + (('?' + p.query) if p.query else '')


rules = []
for line in open(os.path.join(ROOT, '_redirects'), encoding='utf-8'):
    if line.startswith('/'):
        old, new, status = line.split()
        rules.append((old, new, int(status)))

jobs = []   # (label, url, expected_status, expected_location_path or None)
for i, (old, new, status) in enumerate(rules):
    jobs.append(('rule  ' + old, BASE + old, status, new))
    jobs.append(('dest  ' + new, BASE + new, 200, None))
    if not old.endswith('.html') and i % 4 == 0:
        jobs.append(('no-slash  ' + old, BASE + old.rstrip('/'), status, new))
        jobs.append(('UPPER  ' + old, BASE + old.upper().replace('.HTML', '.html'), status, new))
        jobs.append(('query  ' + old, BASE + old + '?utm_source=test', status, new + '?utm_source=test'))
for label, path, want in (
        ('home', '/', 200), ('about page', '/about/', 200), ('blog hub', '/blog/', 200),
        ('blog post', '/blog/healthcare-ads-rejected/', 200), ('blog page 2', '/blog/page/2/', 200),
        ('blog 404', '/blog/no-such-post-xyz/', 404), ('unknown old url', '/no-such-page-xyz/', 404),
        ('insights was never live', '/insights/', 404), ('wp login', '/blog/wp-login.php', 200)):
    jobs.append(('keeps working: ' + label, BASE + path, want, None))


def run(job):
    label, url, want_status, want_loc = job
    code, loc = probe(url)
    ok = code == want_status
    if ok and want_loc is not None:
        ok = path_query(loc) == want_loc
    return ok, label, url, code, loc, want_status, want_loc


with cf.ThreadPoolExecutor(6) as ex:
    results = list(ex.map(run, jobs))
bad = [r for r in results if not r[0]]
print('%d checks against %s | passed: %d | FAILED: %d' % (len(results), BASE, len(results) - len(bad), len(bad)))
for ok, label, url, code, loc, ws, wl in bad[:40]:
    print('  FAIL', label, '| got', code, loc or '', '| wanted', ws, wl or '')
sys.exit(1 if bad else 0)
