#!/usr/bin/env python3
"""Write the client reviews into the site's pages from tools/reviews/reviews.json.

The reviews component is /assets/css/reviews.css (classes .crv-*) and /assets/reviews.js. This script renders its HTML and puts it in
the 36 pages that carry a client quote, between two marker comments:

    <!-- reviews:begin <block> -->  ...generated...  <!-- reviews:end <block> -->

Do not edit what sits between the markers by hand: change reviews.json and run this script again. The first run finds the quote
block each page had before (the homepage carousel, the service-page carousel, the division and industry quotes, the case study
quotes) and replaces it; later runs only replace what is between the markers, so it is safe to re-run.

    python3 tools/build_reviews.py                 # check the data and show what would change (writes nothing)
    python3 tools/build_reviews.py --write         # write the pages
    python3 tools/build_reviews.py --write --allow-missing   # development: leave out people whose photo file is not there yet
    python3 tools/build_reviews.py --write --dev-fill        # layout testing only: stand-in photos. Revert with git checkout before committing

Rules the script enforces (they are the site's own QA rules): the brand name is "Consultus Digital" in full, no em dashes, no
escaped characters, every person has a photo that exists and an alt text. A person that is not in reviews.json is not published.
"""
import html
import json
import os
import re
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA = os.path.join(ROOT, 'tools', 'reviews', 'reviews.json')
CSS_HREF = '/assets/css/reviews.css'
JS_SRC = '/assets/reviews.js'
WALL_LABEL = 'More reviews from our clients'

ALLOW_MISSING = '--allow-missing' in sys.argv
WRITE = '--write' in sys.argv
DEV_FILL = '--dev-fill' in sys.argv   # local layout testing only: stand-in photos for people without one. Never commit or deploy the result.
DEV_PHOTOS = ['stanislav1', 'helen', 'laura', 'melissa', 'tricia', 'nick-chan', 'stefanie-antunes', 'andrea-hardy']


# ---------------------------------------------------------------- data and checks
def load():
    with open(DATA, encoding='utf-8') as f:
        return json.load(f)


def image_size(path):
    """(width, height) of a PNG or WebP file."""
    with open(path, 'rb') as f:
        b = f.read(64)
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', b[16:24])
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        kind = b[12:16]
        if kind == b'VP8X':
            return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
        if kind == b'VP8 ':
            return int.from_bytes(b[26:28], 'little') & 0x3fff, int.from_bytes(b[28:30], 'little') & 0x3fff
        if kind == b'VP8L':
            bits = int.from_bytes(b[21:25], 'little')
            return (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1
    return None


def site_path(url):
    return os.path.join(ROOT, url.lstrip('/'))


def text_problems(text, where):
    out = []
    if '—' in text:
        out.append('%s: em dash' % where)
    if re.search(r'Consultus(?! Digital)', text):
        out.append('%s: brand name must be "Consultus Digital"' % where)
    if re.search(r'Consultus digital', text):
        out.append('%s: "Consultus digital" (capital D)' % where)
    if '\\' in text:
        out.append('%s: backslash left in the text' % where)
    if '  ' in text or text != text.strip():
        out.append('%s: stray spaces' % where)
    if "'" in text:
        out.append('%s: straight apostrophe (use the typographic one)' % where)
    if text and text[-1] not in '.!?"”':
        out.append('%s: does not end with punctuation' % where)
    return out


def resolve(data, ref):
    """'id' or 'id:variant' -> one flat record."""
    pid, _, var = ref.partition(':')
    person = next((p for p in data['people'] if p['id'] == pid), None)
    if person is None:
        raise KeyError('unknown person %s' % pid)
    rec = dict(person)
    if var:
        v = person.get('variants', {}).get(var)
        if v is None:
            raise KeyError('%s has no variant %s' % (pid, var))
        rec.update(v)
    return rec


def photo_info(p):
    """Where the photo files are and how big. None if the person has no photo yet."""
    ph = p.get('photo')
    if not ph and DEV_FILL:
        ph = {'src': '/assets/services/%s.webp' % DEV_PHOTOS[sum(map(ord, p['id'])) % len(DEV_PHOTOS)]}
    if not ph:
        return None
    if 'src' in ph:
        src = ph['src']
        if not os.path.exists(site_path(src)):
            return {'missing': src}
        w, h = image_size(site_path(src))
        return {'src': src, 'src420': src, 'width': w, 'height': h, 'srcset': None}
    stem = ph['stem']
    s840, s420 = '/assets/reviews/%s-840.webp' % stem, '/assets/reviews/%s-420.webp' % stem
    for s in (s840, s420):
        if not os.path.exists(site_path(s)):
            return {'missing': s}
    w, h = image_size(site_path(s840))
    return {'src': s840, 'src420': s420, 'width': w, 'height': h, 'srcset': '%s 420w, %s 840w' % (s420, s840)}


def validate(data):
    errors = []
    ids = set()
    for p in data['people']:
        pid = p['id']
        if pid in ids:
            errors.append('%s: listed twice' % pid)
        ids.add(pid)
        for key in ('name', 'quote', 'alt', 'source'):
            if not p.get(key):
                errors.append('%s: missing %s' % (pid, key))
        errors += text_problems(p.get('quote', ''), pid + ' quote')
        for vk, v in p.get('variants', {}).items():
            if 'quote' in v:
                errors += text_problems(v['quote'], '%s:%s quote' % (pid, vk))
        for field in ('name', 'title', 'company'):
            if 'Consultus' in p.get(field, '') and 'Consultus Digital' not in p.get(field, ''):
                errors.append('%s: %s says bare Consultus' % (pid, field))
        if p.get('logo') and not os.path.exists(site_path(p['logo'])):
            errors.append('%s: logo file missing %s' % (pid, p['logo']))
        if p.get('logo') and not p.get('logo_alt'):
            errors.append('%s: logo without alt text' % pid)
    for bid, b in data['blocks'].items():
        refs = list(b.get('people', [])) + list(b.get('featured', [])) + list(b.get('wall', []))
        for r in refs:
            try:
                resolve(data, r)
            except KeyError as e:
                errors.append('block %s: %s' % (bid, e))
        if b['style'] not in ('wall', 'featured', 'single-row', 'single-center', 'remove'):
            errors.append('block %s: unknown style %s' % (bid, b['style']))
    return errors


# ---------------------------------------------------------------- rendering
def e(s):
    return html.escape(s, quote=True)


def role_of(p):
    return ', '.join(x for x in (p.get('title', ''), p.get('company', '')) if x)


def img_tag(src, alt, width, height, cls=None, srcset=None, sizes=None):
    parts = ['<img']
    if cls:
        parts.append('class="%s"' % cls)
    parts.append('src="%s"' % src)
    if srcset:
        parts.append('srcset="%s"' % srcset)
    if sizes:
        parts.append('sizes="%s"' % sizes)
    parts.append('alt="%s"' % e(alt))
    parts.append('width="%d" height="%d"' % (width, height))
    parts.append('loading="lazy" decoding="async">')
    return ' '.join(parts)


def logo_html(p):
    if not p.get('logo'):
        return ''
    w, h = image_size(site_path(p['logo'])) if p['logo'].lower().endswith(('.png', '.webp')) else (160, 44)
    return img_tag(p['logo'], p.get('logo_alt', ''), w, h, cls='crv-logo')


def photo_html(p, ph, cls, sizes, use420=False):
    src = ph['src420'] if use420 else ph['src']
    if use420 or not ph['srcset']:
        w, h = (ph['width'], ph['height'])
        return img_tag(src, p['alt'], w, h, srcset=None, sizes=None)
    return img_tag(src, p['alt'], ph['width'], ph['height'], srcset=ph['srcset'], sizes=sizes)


def quote_html(text, tag_cls):
    paras = [t for t in text.split('\n\n') if t]
    return '<blockquote class="%s">%s</blockquote>' % (tag_cls, ''.join('<p>%s</p>' % e(t) for t in paras))


def credit_html(p):
    role = role_of(p)
    return '<div class="crv-credit"><strong class="crv-name">%s</strong>%s</div>' % (
        e(p.get('display_name') or p['name']), '<span class="crv-role">%s</span>' % e(role) if role else '')


def slide_html(p, ph, i=None, n=None, show_source=True):
    label = ' role="group" aria-roledescription="slide" aria-label="%d of %d"' % (i, n) if n else ''
    meta = []
    logo = logo_html(p)
    if logo:
        meta.append(logo)
    if show_source and p.get('source'):
        meta.append('<span class="crv-source">%s</span>' % e(p['source']))
    return (
        '<article class="crv-slide"%s>\n'
        '  <figure class="crv-photo">%s</figure>\n'
        '  <div class="crv-body">\n'
        '    %s\n'
        '    %s\n'
        '    %s\n'
        '  </div>\n'
        '</article>'
    ) % (
        label,
        photo_html(p, ph, 'crv-photo', '(max-width: 640px) 230px, (max-width: 900px) 260px, 340px'),
        quote_html(p['quote'], 'crv-quote'),
        credit_html(p),
        '<div class="crv-meta">%s</div>' % ''.join(meta) if meta else '',
    )


def carousel_html(people, label):
    n = len(people)
    slides = '\n'.join(slide_html(p, ph, i + 1, n) for i, (p, ph) in enumerate(people))
    controls = ''
    if n > 1:
        controls = (
            '\n<div class="crv-controls">\n'
            '  <button type="button" class="crv-btn crv-prev" aria-label="Previous review" disabled>'
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
            '  <span class="crv-count" aria-live="polite">1 / %d</span>\n'
            '  <button type="button" class="crv-btn crv-next" aria-label="Next review">'
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n'
            '</div>'
        ) % n
    if n == 1:
        return '<div class="crv-featured">\n%s\n</div>' % slide_html(people[0][0], people[0][1])
    return (
        '<div class="crv-featured">\n'
        '<div class="crv-viewport" role="region" aria-roledescription="carousel" aria-label="%s" tabindex="0">\n'
        '<div class="crv-track">\n%s\n</div>\n</div>%s\n</div>'
    ) % (e(label), slides, controls)


def card_html(p, ph):
    foot = []
    if p.get('source'):
        foot.append('<span class="crv-source">%s</span>' % e(p['source']))
    logo = logo_html(p)
    if logo:
        foot.append(logo)
    role = role_of(p)
    return (
        '<li class="crv-card">\n'
        '  <div class="crv-card-head">\n'
        '    <figure class="crv-avatar">%s</figure>\n'
        '    <div class="crv-credit"><strong class="crv-name">%s</strong>%s</div>\n'
        '  </div>\n'
        '  %s\n'
        '  <div class="crv-card-foot">%s</div>\n'
        '</li>'
    ) % (
        photo_html(p, ph, 'crv-avatar', None, use420=True),
        e(p.get('display_name') or p['name']),
        '<span class="crv-role">%s</span>' % e(role) if role else '',
        quote_html(p['quote'], 'crv-text'),
        ''.join(foot),
    )


def block_html(data, bid, b, people_of):
    """The HTML between the markers for a block. people_of(refs) -> [(record, photo)] (missing photos handled there)."""
    style = b['style']
    if style == 'wall':
        feat = people_of(b['featured'])
        wall = people_of(b['wall'])
        if not feat or not wall:
            return None
        cards = '\n'.join(card_html(p, ph) for p, ph in wall)
        return (
            '<div class="crv crv--wall">\n%s\n'
            '<div class="crv-wall">\n<div class="crv-wall-head"><span class="crv-wall-label">%s</span></div>\n'
            '<ul class="crv-wall-list">\n%s\n</ul>\n</div>\n</div>'
        ) % (carousel_html(feat, 'Featured client reviews'), e(WALL_LABEL), cards)
    people = people_of(b['people'])
    if not people:
        return None
    if style == 'featured':
        return '<div class="crv crv--featured">\n%s\n</div>' % carousel_html(people, 'Client reviews')
    p, ph = people[0]
    mode = 'row' if style == 'single-row' else 'center'
    return '<div class="crv crv--single crv--%s">\n%s\n</div>' % (mode, slide_html(p, ph, show_source=False))


# ---------------------------------------------------------------- patching the pages
def markers(bid, inner):
    return '<!-- reviews:begin %s -->\n%s\n<!-- reviews:end %s -->' % (bid, inner, bid)


MARK_RE = lambda bid: re.compile(r'<!-- reviews:begin %s -->.*?<!-- reviews:end %s -->' % (re.escape(bid), re.escape(bid)), re.S)


def empty_markers(bid):
    return '<!-- reviews:begin %s --><!-- reviews:end %s -->' % (bid, bid)


def wrapped(bid, open_tag, close_tag, inner):
    """Markers that hold the block's wrapper too, so a block that is taken off (empty markers) can come back later.
    Nothing to show (inner is None) leaves empty markers and no wrapper on the page."""
    return markers(bid, open_tag + '\n' + inner + '\n' + close_tag) if inner else empty_markers(bid)


def patch_home(t, bid, inner):
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: markers(bid, inner), t, count=1)
    a = t.find('<section class="sec" id="client-testimonials">')
    b = t.find('</section>', a)
    m = re.search(r'(<div class="sec-head">.*?<p class="tst-sub">.*?</p>\s*</div>)', t[a:b], re.S)
    if a < 0 or not m:
        raise ValueError('homepage testimonial section not found')
    head_end = a + m.end()
    return t[:head_end] + '\n  ' + markers(bid, inner) + '\n  ' + t[b:]


def patch_service(t, bid, inner):
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: markers(bid, inner), t, count=1)
    a = t.find('id="gads-testimonials"')
    if a < 0:
        raise ValueError('service testimonial section not found')
    m = re.compile(r'<div\s+class="gads-testimonial-track"').search(t, a)
    b = t.find('</section>', a)
    if not m or b < 0:
        raise ValueError('service carousel not found')
    tail = re.sub(r'\s+', '', t[m.start():b])
    if not tail.endswith('</div></div>'):
        raise ValueError('service section does not end as expected')
    return t[:m.start()] + markers(bid, inner) + '\n\t\t</div>\n\t' + t[b:]


def patch_division(t, bid, inner):
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: markers(bid, inner), t, count=1)
    a = t.find('<div class="dp-tsts">')
    b = t.find('</section>', a)
    if a < 0 or b < 0 or not t[a:b].rstrip().endswith('</div>'):
        raise ValueError('division reviews block not found')
    return t[:a] + markers(bid, inner) + '\n' + t[b:]


BKC_RE = re.compile(r'<div class="bkc-review">\s*<div class="bkc-stars">.*?</div>\s*<p class="bkc-quote">.*?</p>\s*<div class="bkc-author">.*?</div>\s*</div>', re.S)


def patch_industry(t, bid, inner):
    new = wrapped(bid, '<div class="bkc-review">', '</div>', inner)
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: new, t, count=1)
    m = BKC_RE.search(t)
    if not m:
        raise ValueError('industry review not found')
    return t[:m.start()] + new + t[m.end():]


TESTIMONIAL_RE = re.compile(r'<section class="testimonial">.*?</section>', re.S)


def patch_case_testimonial(t, bid, inner):
    new = wrapped(bid, '<section class="testimonial">', '</section>', inner)
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: new, t, count=1)
    m = TESTIMONIAL_RE.search(t)
    if not m:
        raise ValueError('case study testimonial section not found')
    return t[:m.start()] + new + t[m.end():]


ECO_RE = re.compile(r'<section class="sec bone-full">\s*<div class="sec-inner" style="max-width:900px">\s*<div class="section-lbl rv">The Client</div>.*?</section>', re.S)
OBC_RE = re.compile(r'(<section class="sec bone-full">\s*<div class="sec-inner">\s*<div style="max-width:880px;margin:0 auto;text-align:center;padding:40px 0">\s*<div class="eyebrow"[^>]*>\s*<span class="eyebrow-dot"></span>\s*<span>In their words</span>\s*</div>)(.*?)(\s*</div>\s*</div>\s*</section>)', re.S)


ECO_OPEN = '<section class="sec bone-full">\n    <div class="sec-inner" style="max-width:900px">\n      <div class="section-lbl rv">The Client</div>'
ECO_CLOSE = '    </div>\n  </section>'
# Eco-shell case studies that had no client quote yet: the "The Client" band goes in front of this element
INSERT_BEFORE = {'case-dragonscale-supplies': '<section class="sec dark-full rcx-section"'}


def patch_case_special(t, bid, inner):
    """Eco-shell case studies ('The Client' band) and the Ontario Business Central page ('In their words', its own wrapper stays outside the markers)."""
    if bid == 'case-ontario-business-central':
        empty = empty_markers(bid)
        if MARK_RE(bid).search(t):
            return MARK_RE(bid).sub(lambda m: markers(bid, inner) if inner else empty, t, count=1)
        m = OBC_RE.search(t)
        if not m:
            raise ValueError('case study quote block not found')
        new = (m.group(1) + '\n' + markers(bid, inner) + '\n' + m.group(3)) if inner else empty
        return t[:m.start()] + new + t[m.end():]
    new = wrapped(bid, ECO_OPEN, ECO_CLOSE, inner)
    if MARK_RE(bid).search(t):
        return MARK_RE(bid).sub(lambda m: new, t, count=1)
    m = ECO_RE.search(t)
    if m:
        return t[:m.start()] + new + t[m.end():]
    anchor = INSERT_BEFORE.get(bid)
    if anchor and t.count(anchor) == 1:
        return t.replace(anchor, new + '\n\n  ' + anchor, 1)
    raise ValueError('case study quote block not found')


CASE_TESTIMONIAL_PAGES = ('bow-city-storage', 'ecycle', 'office-shop', 'spieth-america', 'tonic-eye-care', 'western-asphalt')


def patcher_for(bid, b):
    if bid == 'home':
        return patch_home
    if bid == 'service':
        return patch_service
    if bid.startswith('division-'):
        return patch_division
    if bid.startswith('industry-'):
        return patch_industry
    if bid.startswith('case-'):
        return patch_case_testimonial if bid[len('case-'):] in CASE_TESTIMONIAL_PAGES else patch_case_special
    raise ValueError('no patcher for ' + bid)


def add_assets(t, needs_css, needs_js):
    if needs_css and CSS_HREF not in t:
        last = list(re.finditer(r'<link rel="stylesheet" href="/assets/[^"]*">', t))
        if not last:
            raise ValueError('no stylesheet link to put reviews.css after')
        pos = last[-1].end()
        t = t[:pos] + '\n<link rel="stylesheet" href="%s">' % CSS_HREF + t[pos:]
    if needs_js and JS_SRC not in t:
        i = t.rfind('</body>')
        if i < 0:
            raise ValueError('no </body>')
        t = t[:i] + '<script src="%s" defer></script>\n' % JS_SRC + t[i:]
    return t


# ---------------------------------------------------------------- main
def main():
    data = load()
    errors = validate(data)
    skipped = {}

    memo = {}

    def people_of_factory(bid):
        def people_of(refs):
            out = []
            for r in refs or []:
                key = (bid, r)
                if key not in memo:
                    p = resolve(data, r)
                    ph = photo_info(p)
                    if ph is None or 'missing' in ph:
                        why = 'no photo yet' if ph is None else 'photo file missing: %s' % ph['missing']
                        if ALLOW_MISSING:
                            skipped.setdefault(bid, []).append('%s (%s)' % (r, why))
                        else:
                            errors.append('block %s: %s has %s' % (bid, r, why))
                        memo[key] = None
                    else:
                        memo[key] = (p, ph)
                if memo[key]:
                    out.append(memo[key])
            return out
        return people_of

    plan = []   # (page, bid, inner|None, patcher)
    for bid, b in data['blocks'].items():
        pages = ['%s/index.html' % pg for pg in b['pages']] if 'pages' in b else [b['page']]
        if b['style'] == 'remove':
            for pg in pages:
                plan.append((pg, bid, None, patcher_for(bid, {'page': pg})))
            continue
        pf = people_of_factory(bid)
        inner = block_html(data, bid, b, pf)
        if inner is None:
            if ALLOW_MISSING:
                print('  skipped  %s: nobody to show yet, the page keeps its old block' % bid)
            continue
        for pg in pages:
            plan.append((pg, bid, inner, patcher_for(bid, {'page': pg})))

    if errors:
        print('PROBLEMS (%d):' % len(errors))
        for x in errors:
            print('  -', x)
        if not ALLOW_MISSING or any('no photo yet' not in x and 'photo file missing' not in x for x in errors):
            print('\nNothing written.')
            sys.exit(1)

    changed = 0
    for pg, bid, inner, patch in plan:
        path = os.path.join(ROOT, pg)
        old = open(path, encoding='utf-8').read()
        # the service blocks have the same markup on every page; their block id is shared, the markers are per page
        try:
            new = patch(old, bid, inner)
            new = add_assets(new, needs_css=bool(inner), needs_js=bool(inner and ('crv-viewport' in inner or 'crv-wall-list' in inner)))
        except ValueError as ex:
            print('  !! %s: %s' % (pg, ex))
            sys.exit(1)
        state = 'changed' if new != old else 'same'
        if new != old:
            changed += 1
            if WRITE:
                open(path, 'w', encoding='utf-8').write(new)
        print('  %-8s %-48s %s' % (state, pg, bid))
    print('\n%d of %d pages %s.' % (changed, len(plan), 'written' if WRITE else 'would change (add --write)'))
    for bid, lst in skipped.items():
        print('left out of %s for now: %s' % (bid, ', '.join(lst)))


if __name__ == '__main__':
    main()
