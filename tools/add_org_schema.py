#!/usr/bin/env python3
"""Put the one shared business block (schema.org ProfessionalService + LocalBusiness, @id .../#organization) into the <head>
of every indexable static page. Safe to re-run: an existing copy of the block is replaced, never duplicated.

    python3 tools/add_org_schema.py            # writes the pages
    python3 tools/add_org_schema.py --check    # only reports what would change

What it does NOT touch: the page-specific blocks (Service, FAQPage, Article, the city pages' LocalBusiness with their own
name and city, the city hubs' ProfessionalService). It REMOVES two older partial copies of the same company on purpose,
because the new block replaces them: the homepage's ProfessionalService (name, url, phone, address, "$$") and Careers'
Organization (name, url, logo, phone, address, sameAs, description).

Left out on purpose (Oct 12 2026 decision): aggregateRating and review quotes (the Google count is 48, other figures differ),
priceRange (a placeholder), geo (no verified coordinates), email, and a Product block.

Pages that never get it: thank-you/ (noindex), 404.html and the two redirect stubs (services/google-ads/, industries/healthcare/).
The blog gets the same facts from Rank Math's Local SEO settings instead (see CLAUDE.md).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKIP_DIRS = ('.claude/', 'tools/', 'docs/', 'wp-theme/', 'seo-migration/', 'assets/')
SKIP_PAGES = {'thank-you/index.html', 'services/google-ads/index.html', 'industries/healthcare/index.html'}
ID = 'https://consultusdigital.com/#organization'

BLOCK = {
    '@context': 'https://schema.org',
    '@type': ['ProfessionalService', 'LocalBusiness'],
    '@id': ID,
    'name': 'Consultus Digital',
    'url': 'https://consultusdigital.com/',
    'logo': 'https://consultusdigital.com/assets/brand/consultus-wordmark-dark.png',
    'image': 'https://consultusdigital.com/assets/brand/og-share.jpg',
    'description': 'Toronto digital marketing agency: paid media, search, creative, web and CRM.',
    'telephone': '+1-416-460-1810',
    'address': {
        '@type': 'PostalAddress',
        'streetAddress': '136 Geary Ave, Unit 109',
        'addressLocality': 'Toronto',
        'addressRegion': 'ON',
        'postalCode': 'M6H 4H1',
        'addressCountry': 'CA',
    },
    'hasMap': 'https://maps.app.goo.gl/Nho4nKjZLagh5C776',
    'openingHoursSpecification': [{
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '09:00',
        'closes': '18:00',
    }],
    'areaServed': 'North America',
    'sameAs': [
        'https://ca.linkedin.com/company/consultus-digital',
        'https://www.instagram.com/consultusdigi/',
        'https://www.facebook.com/ConsultusDigi/',
        'https://www.youtube.com/channel/UCNbbbaKtyKHBbatPiVnffAQ',
        'https://x.com/Consultusdigi',
    ],
}
SCRIPT = '<script type="application/ld+json">' + json.dumps(BLOCK, indent=2, ensure_ascii=False) + '</script>'
JSONLD = re.compile(r'[ \t]*<script type="application/ld\+json">(.*?)</script>[ \t]*\n?', re.S)


def is_old_partial(raw, path):
    """The two older partial copies of this same company that the new block replaces."""
    try:
        d = json.loads(raw)
    except ValueError:
        return False
    if not isinstance(d, dict):
        return False
    if path == 'index.html':
        return d.get('@type') == 'ProfessionalService' and d.get('name') == 'Consultus Digital' and d.get('url') == 'https://consultusdigital.com/'
    if path == 'careers/index.html':
        return d.get('@type') == 'Organization' and d.get('name') == 'Consultus Digital'
    return False


def process(path, text):
    removed = 0   # older partial copies dropped (an earlier copy of the new block is replaced silently)

    def drop(m):
        nonlocal removed
        raw = m.group(1)
        if ID in raw:
            return ''
        if is_old_partial(raw, path):
            removed += 1
            return ''
        return m.group(0)
    text = JSONLD.sub(drop, text)
    assert text.count('</head>') == 1, path
    text = text.replace('</head>', SCRIPT + '\n</head>', 1)
    return text, removed


def pages():
    out = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\n')
    return sorted(f for f in out if f and re.search(r'(^|/)index\.html$', f) and not f.startswith(SKIP_DIRS) and f not in SKIP_PAGES)


def main():
    check = '--check' in sys.argv
    changed = same = 0
    replaced_old = []
    for f in pages():
        p = os.path.join(ROOT, f)
        s = open(p, encoding='utf-8').read()
        new, removed = process(f, s)
        if removed and f in ('index.html', 'careers/index.html'):
            replaced_old.append(f)
        if new != s:
            changed += 1
            if not check:
                open(p, 'w', encoding='utf-8').write(new)
        else:
            same += 1
    print('%s: %d pages %s, %d already current' % ('would change' if check else 'changed', changed, '', same))
    print('older partial copy removed on:', replaced_old)


if __name__ == '__main__':
    main()
