#!/usr/bin/env python3
"""Give every <img alt=""> on the static pages a real alt text. Safe to re-run: an image that already has alt text is never touched.

    python3 tools/fix_img_alts.py            # writes the pages
    python3 tools/fix_img_alts.py --check    # only reports what would change (and exits 1 if something would)

Why (Oct 13 2026, Ectesso's "Missing image alts" sheet): their crawler counts alt="" as missing alt text (it is valid HTML for a
decorative image, but it shows up in an SEO audit). Two kinds of image get a name here:
  * decorative icons and logos that sit next to the text they illustrate (tick marks, rating badges, card icons, client logos):
    alt = a short name taken from the file name ("Checkmark", "Win rate icon") AND aria-hidden="true", so a screen reader skips
    the image exactly as it did with alt="" (the neighbouring text already says everything);
  * real pictures (office photos, ad creatives, client cards): alt = what the picture shows, written from the picture itself
    (PHOTO_ALTS below). Those that sit inside an aria-hidden collage stay hidden; a stand-alone photo is not hidden.
An <img> with no alt attribute at all is treated like alt="".

New page, new icon: add the picture to PHOTO_ALTS if it is a photo; an icon needs nothing (the file name is used).
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKIP_DIRS = ('.claude', 'tools', 'docs', 'wp-theme', 'seo-migration', 'assets', 'node_modules', 'private', '.git')

# What each real picture shows (checked by looking at the file). Keys are the src without any ?v= stamp.
PHOTO_ALTS = {
    '/assets/team/office-lounge.jpg': 'The Consultus Digital lounge',
    '/assets/team/boardroom.webp': 'Consultus Digital team meeting around the boardroom table',
    '/assets/team/office-pingpong.jpg': 'The Consultus Digital office with a ping pong table',
    '/assets/team/office-meeting.jpg': 'Consultus Digital team in a meeting room',
    '/assets/careers/workspace-view.jpg': 'Laptop and camera on a balcony table above the water',
    '/assets/google-ads/north-america-dots.png': 'Dotted map of North America',
    '/assets/work/dragonscale/static-3-1a.jpg': 'Dragonscale ad: Protection for grails, big or small',
    '/assets/work/dragonscale/static-1b.jpg': 'Dragonscale ad: Transform the look of your Pokemon collection',
    '/assets/work/dragonscale/static-2a-v2.jpg': 'Dragonscale ad: Personalize your Pokemon collection like never before',
    '/assets/work/dragonscale/static-4a.jpg': 'Dragonscale ad with a customer review and a before and after of the card guards',
    '/assets/work/dragonscale/static-1a.jpg': 'Dragonscale ad: Defend your Pokemon TCG collection',
    '/assets/work/e11ement/search-ad.jpg': 'e11ement search ad for the Hypochlorous Acid Spray holiday deals',
    '/assets/work/e11ement/after-site-full.jpg': 'Full-page view of the rebuilt e11ement website',
    '/assets/work/e11ement/social-model.jpg': 'Woman smiling and holding an e11ement spray bottle',
    '/assets/work/eco-choice/statics/offer-v1.jpg': 'Eco Choice Windows & Doors ad: Spring Sale, 40% off windows',
    '/assets/work/eco-choice/statics-door-v2.jpg': 'Eco Choice Windows & Doors ad: High Performance Door System',
    '/assets/work/gordons/static-s02.jpg': 'Gordons ad: A brokerage built for executors',
    '/assets/work/gordons/gd-s04.png': 'Gordons ad: Full-service estate settlement for estate trustees',
    '/assets/work/tonic/static-vision-therapy.png': 'Tonic Eye Care ad: Specialized vision therapy sessions',
    '/assets/work/bookseats/static-pf-blue.jpg': 'BookSeats ad: Bundle your tickets and travel to unlock exclusive discounts',
    '/assets/work/la-vie/lifestyle-early-detection.jpg': 'La Vie ad: Healthcare built for early detection',
    '/assets/work/zayouna/zl-s02-4-5.jpg': 'Zayouna Law Firm ad comparing a settlement mill with Zayouna Law Firm',
    '/assets/work/zayouna/zl-s1-rs.png': 'Zayouna Law Firm ad: Injured in an Uber accident? Get compensated for your injury',
    '/assets/work/cards/tonic-eye-care.jpg': 'Inside a Tonic Eye Care clinic with eyewear displays',
    '/assets/work/cards/spieth-america.jpg': 'Gymnast on a balance beam in a training gym',
    '/assets/work/cards/office-shop.jpg': 'Office furniture showroom with wooden desks and chairs',
}

# The four client logos used on the service pages (the client's name is printed next to each one).
LOGO_ALTS = {
    'new_logo1.svg': 'Bow City Storage logo',
    'new_logo2.svg': 'Harmony Resorts logo',
    'new_logo3.svg': 'Ontario Business Central logo',
    'new_logo4.svg': 'Spieth America logo',
}
SPECIAL_ALTS = {
    'tick-icon.svg': 'Checkmark',
    'quotes-icon.svg': 'Quotation mark',
    'arrow-down.svg': 'Down arrow',
}


# Words in file names that need a fix: typos in the file names, glued-together words, acronyms and brand spellings.
TOKEN_FIX = {
    'accontabilty': 'accountability', 'socail': 'social', 'conten': 'content', 'deepindustry': 'deep industry',
    'lowercost': 'lower cost', 'lowcost': 'low cost', 'calltoaction': 'call to action', 'contentmarketing': 'content marketing',
    'emailmarketing': 'email marketing', 'googleads': 'Google Ads', 'paidsocial': 'paid social', 'sitetraffic': 'site traffic',
    'highlyvisual': 'highly visual', 'influencermarketing': 'influencer marketing', 'socialmedia': 'social media',
    'msad': 'Microsoft Ads', 'icn': '', 'lp': 'landing page', 'seo': 'SEO', 'geo': 'GEO', 'cro': 'CRO', 'crm': 'CRM',
    'ai': 'AI', 'gbp': 'GBP', 'roas': 'ROAS', 'ctas': 'CTAs', 'cta': 'CTA', 'b2b': 'B2B', 'tiktok': 'TikTok',
    'youtube': 'YouTube', 'linkedin': 'LinkedIn', 'google': 'Google', 'meta': 'Meta', 'amazon': 'Amazon',
    'microsoft': 'Microsoft', 'zoho': 'Zoho', 'discuss': 'discussion',
}
PHRASE_FIX = [  # joined words that the file names split with a plain hyphen
    (r'\be commerce\b', 'e-commerce'), (r'\bin house\b', 'in-house'), (r'\bin depth\b', 'in-depth'),
    (r'\bcost effective\b', 'cost-effective'), (r'\bdata driven\b', 'data-driven'), (r'\bserver side\b', 'server-side'),
    (r'\bfuture proof\b', 'future-proof'), (r'\bcross platform\b', 'cross-platform'), (r'\bvalue added\b', 'value-added'),
    (r'\bfull scale\b', 'full-scale'), (r'\bclick through\b', 'click-through'), (r'\buser centric\b', 'user-centric'),
    (r'\bover promising\b', 'over-promising'), (r'\bpre mid and post roll\b', 'pre-, mid- and post-roll'),
    (r'\bone size fits all\b', 'one-size-fits-all'), (r'\bthumb up\b', 'thumbs up'), (r'\btime money\b', 'time and money'),
    (r'\bweb dev\b', 'web development'), (r'\b(Google|Meta|Amazon|Microsoft) ads\b', r'\1 Ads'),
    (r'^trust ', ''),
]


def humanize(src):
    """Short name for an icon, from its file name: 'ab-testing--win-rate-icon.webp' -> 'Win rate icon'."""
    base = os.path.basename(src)
    if base in SPECIAL_ALTS:
        return SPECIAL_ALTS[base]
    if base in LOGO_ALTS:
        return LOGO_ALTS[base]
    name = re.sub(r'\.(svg|webp|png|jpe?g|gif)$', '', base, flags=re.I)
    if '--' in name:
        name = name.split('--', 1)[1]
    name = re.sub(r'^\d+[-_]', '', name)             # leading number
    name = re.sub(r'([-_]\d+)+$', '', name)          # trailing -1, -2-3
    if re.fullmatch(r'icon[-_]\d+', name, flags=re.I) or not re.sub(r'(icon|[-_\d])', '', name, flags=re.I):
        return 'Decorative icon'
    words = [w for w in re.split(r'[-_]+', name) if w and w.lower() != 'icon']
    out = []
    for w in words:
        out.append(TOKEN_FIX.get(w.lower(), w.lower()))
    text = ' '.join(x for x in out if x)
    for pat, rep in PHRASE_FIX:
        text = re.sub(pat, rep, text, flags=re.I)
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        return 'Decorative icon'
    return text[0].upper() + text[1:] + ' icon'


IMG_RE = re.compile(r'<img\b[^>]*>', re.I | re.S)
ATTR_ALT_RE = re.compile(r'\balt\s*=\s*("([^"]*)"|\'([^\']*)\')', re.I)
SRC_RE = re.compile(r'\b(?:data-)?src\s*=\s*("([^"]*)"|\'([^\']*)\')', re.I)


def src_of(tag):
    m = re.search(r'(?<![-\w])src\s*=\s*("([^"]*)"|\'([^\']*)\')', tag, re.I)
    if not m:
        m = SRC_RE.search(tag)
    if not m:
        return ''
    return (m.group(2) if m.group(2) is not None else m.group(3)).split('?')[0]


def rewrite_tag(tag):
    """Return (new_tag, alt_added) for one <img> tag, or (tag, None) when it already has alt text."""
    m = ATTR_ALT_RE.search(tag)
    cur = None if not m else (m.group(2) if m.group(2) is not None else m.group(3))
    if cur is not None and cur.strip():
        return tag, None
    src = src_of(tag)
    if not src:
        return tag, None
    photo = PHOTO_ALTS.get(src)
    new_alt = photo if photo else humanize(src)
    new_alt = new_alt.replace('&', '&amp;')
    hidden_attr = '' if (photo or re.search(r'\baria-hidden\s*=', tag, re.I)) else ' aria-hidden="true"'
    if m:
        new = tag[:m.start()] + 'alt="%s"%s' % (new_alt, hidden_attr) + tag[m.end():]
    else:
        new = re.sub(r'<img\b', '<img alt="%s"%s' % (new_alt, hidden_attr), tag, count=1, flags=re.I)
    return new, new_alt


def pages():
    out = []
    for d, dns, fns in os.walk(ROOT):
        rel = os.path.relpath(d, ROOT)
        top = rel.split(os.sep)[0]
        if rel != '.' and (top in SKIP_DIRS or top.startswith('.')):
            dns[:] = []
            continue
        if rel == '.':
            dns[:] = [x for x in dns if x not in SKIP_DIRS and not x.startswith('.')]
        for fn in fns:
            if fn == 'index.html' or (rel == '.' and fn == '404.html'):
                out.append(os.path.join(d, fn))
    return sorted(out)


def main():
    check = '--check' in sys.argv
    total = 0
    changed_files = 0
    seen = {}
    for path in pages():
        with open(path, encoding='utf-8') as f:
            html = f.read()
        count = 0

        def sub(m):
            nonlocal count
            new, added = rewrite_tag(m.group(0))
            if added is not None:
                count += 1
                seen.setdefault(src_of(m.group(0)), added)
            return new

        new_html = IMG_RE.sub(sub, html)
        if count:
            total += count
            changed_files += 1
            if not check:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_html)
    print('%s %d images on %d pages (%d distinct picture files)' % ('would name' if check else 'named', total, changed_files, len(seen)))
    if '--list' in sys.argv:
        for src, alt in sorted(seen.items()):
            print('  %-70s %s' % (src, alt))
    if check and total:
        sys.exit(1)


if __name__ == '__main__':
    main()
