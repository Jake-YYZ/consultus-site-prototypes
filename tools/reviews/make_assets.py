#!/usr/bin/env python3
"""Turn Jake's kit (photos, logos) into the web files the reviews use, and point reviews.json at them.

    python3 tools/reviews/make_assets.py --photos <folder with the full-size PNGs> --alt-csv <alt-text.csv> [--logos <folder with logo PNGs>] [--write]

Without --write it only reports what it would do. Photos: for every person that is in reviews.json and has a row in alt-text.csv, the
full-size PNG becomes /assets/reviews/<name>-840.webp and -420.webp (width 840 and 420, transparency kept) and the person's "photo" in
reviews.json becomes {"stem": "<name>"}. People who are not in reviews.json (quotes on hold) are never converted or copied: the
repository is public. Logos: only for people whose logo is still empty in reviews.json; the PNG is trimmed and saved as a WebP at most
336x88 in /assets/reviews/logos/. File names are new on purpose (Kinsta caches images for 10 years). Needs ImageMagick (magick).
"""
import csv
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA = os.path.join(ROOT, 'tools', 'reviews', 'reviews.json')
OUT = os.path.join(ROOT, 'assets', 'reviews')
LOGO_OUT = os.path.join(OUT, 'logos')
LOGO_HINTS = {'ben-fishbein': ['comwave'], 'shaun-oriold': ['closet-envy', 'closetenvy'], 'kim-benedict': ['talentminded', 'talent-minded'], 'kristin-finley': ['evas', 'eva-s', 'eva_s']}


def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def run(cmd):
    subprocess.check_call(cmd)


def convert_photo(src, width, dst):
    run(['magick', src, '-resize', '%dx>' % width, '-define', 'webp:alpha-quality=92', '-define', 'webp:method=6', '-quality', '82', dst])


def main():
    write = '--write' in sys.argv
    photos, alt_csv, logos = arg('--photos'), arg('--alt-csv'), arg('--logos')
    text = open(DATA, encoding='utf-8').read()
    data = json.loads(text)
    if photos and alt_csv:
        rows = list(csv.DictReader(open(alt_csv, encoding='utf-8', newline='')))
        by_name = {r['name'].strip(): r for r in rows}
        print('Photos (%d rows in alt-text.csv, %d people in reviews.json)' % (len(rows), len(data['people'])))
        for p in data['people']:
            r = by_name.get(p['name'])
            if not r:
                print('  keeps its photo     %-20s (not in alt-text.csv)' % p['id'])
                continue
            png = os.path.join(photos, r['png'])
            if not os.path.exists(png):
                print('  MISSING PNG         %-20s %s' % (p['id'], r['png']))
                continue
            stem = re.sub(r'\.png$', '', r['png'])
            d840, d420 = os.path.join(OUT, stem + '-840.webp'), os.path.join(OUT, stem + '-420.webp')
            print('  %-19s %-20s -> %s' % ('converts' if write else 'would convert', p['id'], stem))
            if write:
                os.makedirs(OUT, exist_ok=True)
                convert_photo(png, 840, d840)
                convert_photo(png, 420, d420)
                print('        %d KB and %d KB' % (os.path.getsize(d840) // 1024, os.path.getsize(d420) // 1024))
                # point the person at the new files (text edit, so the rest of the file keeps its layout)
                m = re.search(r'("id": "%s".*?"photo": )(null|\{[^}]*\})' % re.escape(p['id']), text, re.S)
                text = text[:m.start(2)] + '{ "stem": "%s" }' % stem + text[m.end(2):]
    if logos:
        print('Logos for people without one')
        files = os.listdir(logos)
        for p in data['people']:
            if p.get('logo'):
                continue
            hints = LOGO_HINTS.get(p['id'])
            if not hints:
                continue
            match = next((f for f in sorted(files) for h in hints if h in re.sub(r'[^a-z]', '', f.lower()).replace('-', '') or h in f.lower()), None)
            if not match:
                print('  no logo file found  %-20s (looked for %s)' % (p['id'], ', '.join(hints)))
                continue
            dst = os.path.join(LOGO_OUT, p['id'] + '.webp')
            print('  %-19s %-20s <- %s' % ('converts' if write else 'would convert', p['id'], match))
            if write:
                os.makedirs(LOGO_OUT, exist_ok=True)
                run(['magick', os.path.join(logos, match), '-trim', '+repage', '-resize', '336x88>', '-define', 'webp:lossless=true', dst])
                print('        %d KB' % (os.path.getsize(dst) // 1024))
                alt = '%s logo' % (p.get('company') or p['name'])
                m = re.search(r'("id": "%s".*?)"logo": null,(\s*)"logo_alt": ""' % re.escape(p['id']), text, re.S)
                text = text[:m.start()] + m.group(1) + '"logo": "/assets/reviews/logos/%s.webp",%s"logo_alt": "%s"' % (p['id'], m.group(2), alt) + text[m.end():]
    if write:
        json.loads(text)   # still valid
        open(DATA, 'w', encoding='utf-8').write(text)
        print('reviews.json updated')
    else:
        print('(nothing written, add --write)')


if __name__ == '__main__':
    main()
