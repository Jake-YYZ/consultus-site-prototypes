#!/usr/bin/env python3
"""Turn the live blog's Elementor-rendered posts into clean article records.

Every live post is the same Elementor shell: title/info/share/featured image, then the article
itself (text, heading and image widgets), then five shared template blocks (author bio,
Recommended Articles, promo, contact, Instagram). Only the article widgets are content.

Usage: python3 build_bodies.py DATA_DIR [STAGING_BASE]
Reads  DATA_DIR/live_posts.json
Writes DATA_DIR/bodies.json   (one record per live post)
"""
import html as htmllib
import json
import re
import sys
from urllib.parse import urlparse

from bs4 import BeautifulSoup

LIVE_HOST = 'consultusdigital.com'
STAGING_BASE = 'https://stg-consultusdigital-staging.kinsta.cloud'
BODY_TYPES = ('text-editor', 'heading', 'image')
DROP_IMG_ATTRS = ('loading', 'decoding', 'srcset', 'sizes', 'fetchpriority', 'data-wp-editing')
PLACEHOLDER_HEADINGS = {'add your heading text here'}


def top_widgets(soup):
    """Widgets that are not nested inside another widget, in document order."""
    return [w for w in soup.select('[data-widget_type]')
            if not w.find_parent(attrs={'data-widget_type': True})]


def wtype(w):
    return w['data-widget_type'].split('.')[0]


def to_staging(url, base):
    """Point a live-site URL at the staging site (WordPress lives under /blog there).

    Handles absolute live URLs, protocol-relative ones, root-relative ones ("/wp-content/..."), and
    the doubled-slash form ("https://live.com//wp-content/..." or "//wp-content/...") that older posts use.
    """
    if not url:
        return url
    if url.startswith('//wp-content/'):
        return '/blog' + url[1:]
    if url.startswith('/') and not url.startswith('//'):
        return '/blog' + url if url.startswith('/wp-content/') else url
    u = urlparse(url)
    if u.netloc.lower().replace('www.', '') != LIVE_HOST:
        return url
    path = re.sub(r'^/{2,}', '/', u.path)
    if path.startswith('/wp-content/'):
        path = '/blog' + path
    out = base + path
    if u.query:
        out += '?' + u.query
    if u.fragment:
        out += '#' + u.fragment
    return out


def convert_embeds(frag):
    """Replace oEmbed output with the bare URL WordPress turns back into an embed."""
    for bq in frag.select('blockquote.tiktok-embed[cite]'):
        p = frag.new_tag('p')
        p.string = bq['cite']
        bq.replace_with(p)
    for bq in frag.select('blockquote.twitter-tweet'):
        links = [a['href'] for a in bq.find_all('a', href=True) if '/status/' in a['href']]
        if links:
            p = frag.new_tag('p')
            p.string = links[-1].split('?')[0]
            bq.replace_with(p)
    for sc in frag.find_all('script', src=True):
        if re.search(r'tiktok\.com/embed|platform\.(twitter|x)\.com/widgets', sc['src']):
            sc.decompose()
    for fr in frag.find_all('iframe', src=True):
        m = re.search(r'youtube(?:-nocookie)?\.com/embed/([\w-]{6,})\?feature=oembed', fr['src'])
        if m:
            p = frag.new_tag('p')
            p.string = 'https://www.youtube.com/watch?v=' + m.group(1)
            fr.replace_with(p)


def clean_fragment(html_str, base):
    frag = BeautifulSoup(html_str, 'html.parser')
    convert_embeds(frag)
    for img in frag.find_all('img'):
        for a in DROP_IMG_ATTRS:
            if a in img.attrs:
                del img.attrs[a]
        if img.get('src'):
            img['src'] = to_staging(img['src'], base)
        cls = [c for c in img.get('class', []) if not c.startswith('attachment-')]
        if cls:
            img['class'] = cls
        elif 'class' in img.attrs:
            del img.attrs['class']
    for a in frag.find_all('a', href=True):
        a['href'] = to_staging(a['href'], base)
    return frag


def widget_html(w, base):
    t = wtype(w)
    container = w.select_one('.elementor-widget-container') or w
    if t == 'text-editor':
        frag = clean_fragment(container.decode_contents(), base)
        return str(frag).strip()
    if t == 'heading':
        h = container.find(re.compile(r'^h[1-6]$')) or container.find(['p', 'div', 'span'])
        if not h:
            return ''
        text = h.get_text(' ', strip=True)
        if text.lower() in PLACEHOLDER_HEADINGS:
            return ''
        frag = clean_fragment(h.decode_contents(), base)
        tag = h.name if re.match(r'^h[1-6]$', h.name) else 'h2'
        return '<%s>%s</%s>' % (tag, str(frag).strip(), tag)
    if t == 'image':
        frag = clean_fragment(container.decode_contents(), base)
        return '<p>%s</p>' % str(frag).strip()
    return ''


def parse_post(p, base):
    soup = BeautifulSoup(p['content']['rendered'], 'lxml')
    top = top_widgets(soup)

    info = next((w for w in top if wtype(w) == 'post-info'), None)
    author = ''
    if info:
        a = info.select_one('.elementor-post-info__item--type-author a:last-of-type') \
            or info.select_one('.elementor-post-info__item--type-author')
        author = re.sub(r'^Author:\s*', '', a.get_text(' ', strip=True)) if a else ''

    feat = next((w for w in top if wtype(w) == 'theme-post-featured-image'), None)
    fimg = feat.find('img') if feat else None
    featured = None
    if fimg and fimg.get('src'):
        m = re.search(r'wp-image-(\d+)', ' '.join(fimg.get('class', [])))
        featured = {'id': int(m.group(1)) if m else p['featured_media'],
                    'src': fimg['src'], 'alt': fimg.get('alt', ''),
                    'width': fimg.get('width'), 'height': fimg.get('height')}

    # Body = article widgets that come before the first shared template block.
    body_parts, content_imgs = [], []
    for w in top:
        t = wtype(w)
        if t == 'shortcode':
            break
        if t in BODY_TYPES:
            h = widget_html(w, base)
            if h:
                body_parts.append(h)
            for img in w.find_all('img'):
                m = re.search(r'wp-image-(\d+)', ' '.join(img.get('class', [])))
                if img.get('src'):
                    content_imgs.append({'id': int(m.group(1)) if m else None, 'src': img['src'],
                                         'alt': img.get('alt', '')})
    body = '\n'.join(body_parts)
    # Placeholder-free tidy: collapse blank paragraphs left by the editor.
    body = re.sub(r'<p>(?:\s|&nbsp;|<br\s*/?>)*</p>', '', body)
    return {
        'id': p['id'],
        'slug': p['slug'],
        'link': p['link'],
        'link_path': urlparse(p['link']).path,
        'title': htmllib.unescape(p['title']['rendered']),
        'date': p['date'],
        'date_gmt': p['date_gmt'],
        'modified': p['modified'],
        'author_live_id': p['author'],
        'author_name': author,
        'categories': p['categories'],
        'tags': p['tags'],
        'featured': featured,
        'featured_media': p['featured_media'],
        'body': body,
        'content_images': content_imgs,
    }


def main():
    data = sys.argv[1]
    base = sys.argv[2] if len(sys.argv) > 2 else STAGING_BASE
    posts = json.load(open(data + '/live_posts.json'))
    out = [parse_post(p, base) for p in posts]
    json.dump(out, open(data + '/bodies.json', 'w'))
    empty = [r['id'] for r in out if len(r['body']) < 200]
    noauth = [r['id'] for r in out if not r['author_name']]
    nofeat = [r['id'] for r in out if not r['featured']]
    print('posts:', len(out), '| empty bodies:', empty, '| no author:', noauth, '| no featured img:', nofeat)


if __name__ == '__main__':
    main()
