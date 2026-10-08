#!/usr/bin/env python3
"""Combine the clean live bodies, taxonomy, author blocks and SEO heads into one plan for the server.

Usage: python3 build_plan.py DATA_DIR [--replace ids.json] [--seo ids.json]
Reads  bodies.json, live_posts.json, live_categories.json, live_tags.json, live_heads.json
Writes DATA_DIR/posts_plan.json
  posts[]    one entry per live post (target state)
  authors{}  live author name -> {title, bio}
  replace[]  ids of existing staging posts whose body should be replaced with the live body
"""
import json, re, sys
from bs4 import BeautifulSoup


def author_blocks(live_posts):
    out = {}
    for p in live_posts:                       # later (newer) posts win
        soup = BeautifulSoup(p['content']['rendered'], 'lxml')
        blk = soup.select_one('[data-elementor-id="48664"]')
        if not blk:
            continue
        heads = [h.get_text(' ', strip=True) for h in blk.select('[data-widget_type^="heading"]')]
        te = blk.select_one('[data-widget_type^="text-editor"]')
        if len(heads) >= 2 and te:
            out[heads[0]] = {'title': heads[1], 'bio': te.get_text(' ', strip=True)}
    return out


def main():
    d = sys.argv[1]
    replace, seo_sync = [], []
    if '--replace' in sys.argv:
        replace = json.load(open(sys.argv[sys.argv.index('--replace') + 1]))
    if '--seo' in sys.argv:                      # ids whose Rank Math title/description should be copied from live
        seo_sync = json.load(open(sys.argv[sys.argv.index('--seo') + 1]))
    live_posts = json.load(open(d + '/live_posts.json'))
    bodies = json.load(open(d + '/bodies.json'))
    cats = {c['id']: c for c in json.load(open(d + '/live_categories.json'))}
    tags = {t['id']: t for t in json.load(open(d + '/live_tags.json'))}
    heads = json.load(open(d + '/live_heads.json'))
    posts = []
    for b in bodies:
        uri = b['link_path'].strip('/')
        assert uri.startswith('blog/'), b['link_path']
        h = heads.get(str(b['id']), {})
        posts.append({
            'id': b['id'], 'slug': b['slug'], 'title': b['title'], 'uri': uri[len('blog/'):],
            'date': b['date'].replace('T', ' '), 'date_gmt': b['date_gmt'].replace('T', ' '),
            'modified': b['modified'].replace('T', ' '),
            'author': b['author_name'],
            'categories': [{'slug': cats[c]['slug'], 'name': cats[c]['name'],
                            'parent': cats[cats[c]['parent']]['slug'] if cats[c]['parent'] in cats else None}
                           for c in b['categories'] if c in cats],
            'tags': [{'slug': tags[t]['slug'], 'name': tags[t]['name']} for t in b['tags'] if t in tags],
            'featured_live_id': (b['featured'] or {}).get('id'),
            'body': b['body'],
            'seo': {'title': h.get('title'), 'description': h.get('description')},
        })
    plan = {'posts': posts, 'authors': author_blocks(live_posts), 'replace': replace, 'seo_sync': seo_sync}
    json.dump(plan, open(d + '/posts_plan.json', 'w'))
    print('plan: %d posts | authors: %s | replace: %d' % (len(posts), list(plan['authors']), len(replace)))


if __name__ == '__main__':
    main()
