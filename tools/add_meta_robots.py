#!/usr/bin/env python3
"""Put <meta name="robots" content="index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large"> into the <head>
of every indexable static page, right under the page's <meta name="description">. Safe to re-run: an existing robots tag that this
tool wrote is replaced in place, never duplicated.

    python3 tools/add_meta_robots.py            # writes the pages
    python3 tools/add_meta_robots.py --check    # only reports what would change

Why (Oct 13 2026, Ectesso's "Meta robots Missing" sheet): the pages had no robots tag at all. Search engines treat that as
"index, follow", so nothing was wrong, but the tag states it and the three max-* values let Google show full snippets and large
image previews (the same string the blog's Rank Math prints on its category pages).

Pages that never get it: thank-you/ (its own "noindex, follow"), 404.html (its own "noindex, nofollow") and the two redirect stubs
(services/google-ads/, industries/healthcare/: their own "noindex"). XML sitemaps and CSS files cannot carry a meta tag.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKIP_DIRS = ('.claude/', 'tools/', 'docs/', 'wp-theme/', 'seo-migration/', 'assets/')
SKIP_PAGES = {'thank-you/index.html', 'services/google-ads/index.html', 'industries/healthcare/index.html'}
CONTENT = 'index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large'
TAG = '<meta name="robots" content="%s">' % CONTENT
ROBOTS = re.compile(r'(?P<indent>[ \t]*)<meta name="robots"[^>]*>[ \t]*\n?', re.I)
DESC = re.compile(r'(?P<indent>[ \t]*)<meta name="description"[^>]*>[ \t]*\n', re.I)


def process(path, text):
    if re.search(r'<meta name="robots" content="(?!%s)[^"]*"' % re.escape(CONTENT), text, re.I):
        raise SystemExit('%s already has a different robots tag: look at it by hand' % path)
    text = ROBOTS.sub('', text)
    m = DESC.search(text)
    if not m:
        raise SystemExit('%s has no meta description to anchor the robots tag to' % path)
    return text[:m.end()] + m.group('indent') + TAG + '\n' + text[m.end():]


def pages():
    out = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\n')
    return sorted(f for f in out if f and re.search(r'(^|/)index\.html$', f) and not f.startswith(SKIP_DIRS) and f not in SKIP_PAGES)


def main():
    check = '--check' in sys.argv
    changed = same = 0
    for f in pages():
        p = os.path.join(ROOT, f)
        s = open(p, encoding='utf-8').read()
        new = process(f, s)
        if new != s:
            changed += 1
            if not check:
                open(p, 'w', encoding='utf-8').write(new)
        else:
            same += 1
    print('%s: %d pages, %d already current' % ('would change' if check else 'changed', changed, same))


if __name__ == '__main__':
    main()
