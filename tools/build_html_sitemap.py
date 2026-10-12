#!/usr/bin/env python3
"""Build the visitor-facing HTML sitemap page (site-map/index.html) from sitemap-pages.xml.

The page uses the Contact page's shell (nav, footer, tracking, styles), so it follows any change made there. Labels come
from the curated lists below, and from each page's <title> for everything else. Re-run it whenever a page is added or removed
(and after editing sitemap-pages.xml):   python3 tools/build_html_sitemap.py

Pages that never appear: the thank-you page (noindex), the 404 page and the redirect stubs (none of them is in sitemap-pages.xml).
"""
import html
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SERVICES = [
    ('Acquire', [('/google-ads/', 'Google Ads'), ('/meta-ads/', 'Meta Ads'), ('/microsoft-ads/', 'Microsoft Ads'), ('/amazon-ads/', 'Amazon Ads'),
                 ('/seo/', 'SEO'), ('/local-seo/', 'Local SEO'), ('/content-marketing/', 'Content Marketing'), ('/aeo-ai-search/', 'AEO / AI Search'),
                 ('/influencer-marketing/', 'Influencer Marketing'), ('/performance-creatives/', 'Performance Creatives')]),
    ('Convert', [('/web-development/', 'Web Development'), ('/landing-pages/', 'Landing Pages'), ('/cro/', 'CRO'), ('/ab-testing/', 'A/B Testing')]),
    ('Scale', [('/zoho-crm/', 'Zoho CRM'), ('/marketing-automation/', 'Marketing Automation'), ('/analytics-attribution/', 'Analytics &amp; Attribution'),
               ('/sales-enablement/', 'Sales Enablement')]),
]
DIVISIONS = [
    ('Healthcare', [('/healthcare/', 'Healthcare &amp; Medical')]),
    ('Trades &amp; Construction', [('/home-services-marketing/', 'Home Services'), ('/home-improvement-marketing/', 'Home Improvement')]),
    ('DTC &amp; eCommerce', [('/ecommerce-marketing-toronto/', 'E-commerce &amp; DTC'), ('/retail-consumer-marketing/', 'Retail &amp; Consumer')]),
    ('Professional Services', [('/professional-services-marketing/', 'Professional Services'), ('/law-firm-marketing-toronto/', 'Legal'),
                               ('/insurance-industry/', 'Insurance')]),
    ('Other industries', [('/real-estate-marketing/', 'Real Estate'), ('/self-storage-marketing-toronto/', 'Self-Storage'), ('/b2b-saas-marketing/', 'B2B / SaaS')]),
]
MAIN = [('/', 'Home'), ('/about/', 'About'), ('/careers/', 'Careers'), ('/contact/', 'Contact'), ('/results/', 'Results'),
        ('/case-studies/', 'Case studies'), ('/divisions/', 'Divisions'), ('/services/', 'All services'), ('/locations/', 'Locations'),
        ('/blog/', 'Insights (the blog)'), ('/privacy-policy/', 'Privacy policy')]
CITY_KIND = [('digital-marketing-agency-in-', 'Digital marketing'), ('cro-agency-in-', 'CRO'), ('facebook-advertising-agency-in-', 'Facebook ads'),
             ('instagram-advertising-agency-in-', 'Instagram ads'), ('the-best-microsoft-advertising-agency-in-', 'Microsoft ads'),
             ('google-ads-agency-in-', 'Google Ads'), ('seo-agency-in-', 'SEO')]
MORE_LABELS = {'/seo-toronto/': 'SEO Agency in Toronto', '/reputation-advertising-toronto/': 'Reputation Management'}
VERTICALS = [('E-commerce', ('ecommerce',)), ('Law firms', ('law-firms', 'law-firm', 'legal-practice')), ('Insurance brokers', ('insurance',)),
             ('Self-storage', ('self-storage',))]


def title_of(path):
    f = os.path.join(ROOT, path.strip('/'), 'index.html') if path != '/' else os.path.join(ROOT, 'index.html')
    m = re.search(r'<title>(.*?)</title>', open(f, encoding='utf-8').read(), re.S)
    return re.sub(r'\s*\|\s*Consultus Digital\s*$', '', html.unescape(m.group(1).strip())) if m else path


def esc(t):
    return html.escape(html.unescape(t), quote=False)


def link(path, label):
    return '<li><a href="%s">%s</a></li>' % (path, label)


def city_of(path):
    last = path.strip('/').split('/')[-1]
    for prefix, kind in CITY_KIND:
        if last.startswith(prefix):
            city = last[len(prefix):]
            city = {'new-york-city': 'new-york', 'la': 'los-angeles', 'nyc': 'new-york'}.get(city, city)
            return city, kind
    return None, None


def main():
    urls = [u for u in re.findall(r'<loc>https://consultusdigital\.com(/[^<]*)</loc>', open(os.path.join(ROOT, 'sitemap-pages.xml'), encoding='utf-8').read())]
    used = set(p for p, _ in MAIN) | set(p for _, items in SERVICES + DIVISIONS for p, _ in items)
    cities, verticals, cases, more = {}, {k: [] for k, _ in VERTICALS}, [], []
    for p in urls:
        if p in used or p == '/site-map/':
            continue
        if p.startswith('/case-studies/'):
            cases.append(p); continue
        city, kind = city_of(p)
        if city:
            cities.setdefault(city, []).append((kind, p)); continue
        slug = p.strip('/')
        placed = False
        for name, keys in VERTICALS:
            if any(k in slug for k in keys):
                verticals[name].append(p); placed = True; break
        if not placed:
            more.append(p)

    out = []
    out.append('<section class="sm-block"><h2>Main pages</h2><ul class="sm-list">%s</ul></section>' % ''.join(link(p, l) for p, l in MAIN))
    out.append('<section class="sm-block"><h2>Services</h2><div class="sm-groups">%s</div></section>' % ''.join(
        '<div><h3>%s</h3><ul class="sm-list">%s</ul></div>' % (g, ''.join(link(p, l) for p, l in items)) for g, items in SERVICES))
    out.append('<section class="sm-block"><h2>Divisions and industries</h2><div class="sm-groups">%s</div></section>' % ''.join(
        '<div><h3>%s</h3><ul class="sm-list">%s</ul></div>' % (g, ''.join(link(p, l) for p, l in items)) for g, items in DIVISIONS))
    vblocks = ''.join('<div><h3>%s</h3><ul class="sm-list">%s</ul></div>' % (name, ''.join(link(p, esc(title_of(p))) for p in sorted(ps)))
                      for name, ps in verticals.items() if ps)
    if vblocks:
        out.append('<section class="sm-block"><h2>Industry services in Toronto</h2><div class="sm-groups">%s</div></section>' % vblocks)
    out.append('<section class="sm-block"><h2>Case studies</h2><ul class="sm-list">%s</ul></section>' % ''.join(link(p, esc(title_of(p))) for p in sorted(cases)))
    order = sorted(cities, key=lambda c: (c != 'toronto', c))
    kinds = [k for _, k in CITY_KIND]
    cblocks = ''
    for c in order:
        items = sorted(cities[c], key=lambda kp: (kinds.index(kp[0]), kp[1]))
        cblocks += '<div class="sm-city"><h3>%s</h3><ul class="sm-list">%s</ul></div>' % (esc(c.replace('-', ' ').title()), ''.join(link(p, k) for k, p in items))
    out.append('<section class="sm-block"><h2>Locations</h2><div class="sm-cities">%s</div></section>' % cblocks)
    if more:
        out.append('<section class="sm-block"><h2>More pages</h2><ul class="sm-list">%s</ul></section>' % ''.join(link(p, esc(MORE_LABELS.get(p) or title_of(p))) for p in sorted(more)))

    shell = open(os.path.join(ROOT, 'contact', 'index.html'), encoding='utf-8').read()

    def sub1(pattern, repl, text, flags=0):
        new, n = re.subn(pattern, repl, text, count=1, flags=flags)
        assert n == 1, pattern
        return new

    desc = 'Every page on the Consultus Digital website in one place: services, divisions, case studies, locations and the blog.'
    s = sub1(r'<title>.*?</title>', '<title>Sitemap | Consultus Digital</title>', shell, re.S)
    s = sub1(r'(<meta name="description" content=")[^"]*(">)', r'\g<1>' + desc + r'\2', s)
    s = sub1(r'<link rel="canonical" href="[^"]*" />', '<link rel="canonical" href="https://consultusdigital.com/site-map/" />', s)
    s = sub1(r'(<meta property="og:title" content=")[^"]*(">)', r'\1Sitemap | Consultus Digital\2', s)
    s = sub1(r'(<meta property="og:description" content=")[^"]*(">)', r'\g<1>' + desc + r'\2', s)
    s = sub1(r'(<meta property="og:url" content=")[^"]*(">)', r'\1https://consultusdigital.com/site-map/\2', s)
    s = sub1(r'(<meta name="twitter:title" content=")[^"]*(">)', r'\1Sitemap | Consultus Digital\2', s)
    s = sub1(r'(<meta name="twitter:description" content=")[^"]*(">)', r'\g<1>' + desc + r'\2', s)
    s = sub1(r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema.org",\s*"@type": "WebPage".*?</script>\s*', '', s, re.S)
    main_html = ('<main id="main-content">\n  <section class="sec" style="padding-top:64px;padding-bottom:96px">\n'
                 '    <div class="eyebrow" style="margin-bottom:22px"><span class="eyebrow-dot"></span><span>Find your way</span></div>\n'
                 '    <h1 class="sm-title">Sitemap</h1>\n'
                 '    <p class="sm-lede">Every page on this site, grouped by topic. Looking for an article? Browse them by topic on the <a href="/blog/">Insights</a> page.</p>\n'
                 '    ' + '\n    '.join(out) + '\n  </section>\n</main>')
    i = s.find('<main id="main-content">')
    j = s.find('</main>') + len('</main>')
    assert 0 < i < j
    s = s[:i] + main_html + s[j:]
    css = '''<style>
.sm-title { font-size: clamp(36px, 5vw, 64px); line-height: 1; letter-spacing: -0.025em; margin-bottom: 18px; color: #141414; }
.sm-lede { font-size: 18px; line-height: 1.55; color: #6A686B; max-width: 640px; margin-bottom: 48px; }
.sm-lede a { color: #1A40C7; text-decoration: underline; text-underline-offset: 3px; }
.sm-block { padding: 36px 0; border-top: 1px solid #E1DCD1; }
.sm-block h2 { font-family: var(--wide); font-size: 15px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #141414; margin-bottom: 20px; }
.sm-block h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; color: #141414; margin-bottom: 12px; }
.sm-list { list-style: none; padding: 0; margin: 0; columns: 3 220px; column-gap: 40px; }
.sm-groups .sm-list, .sm-city .sm-list { columns: 1; }
.sm-list li { break-inside: avoid; margin: 0 0 10px; font-size: 15px; line-height: 1.4; }
.sm-list a { color: #141414; text-decoration: none; border-bottom: 1px solid transparent; transition: color 0.2s ease, border-color 0.2s ease; }
.sm-list a:hover, .sm-list a:focus-visible { color: #1A40C7; border-bottom-color: #1A40C7; }
.sm-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px 40px; }
.sm-cities { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 32px 40px; }
</style>
</head>'''
    s = sub1(r'</head>', css, s)
    s = re.sub(r'<script src="/assets/zoho-form\.js[^"]*"[^>]*></script>\s*', '', s)
    os.makedirs(os.path.join(ROOT, 'site-map'), exist_ok=True)
    open(os.path.join(ROOT, 'site-map', 'index.html'), 'w', encoding='utf-8').write(s)
    n = len(re.findall(r'<li><a href=', main_html))
    print('site-map/index.html: %d links, %d sitemap URLs (%d in groups below the curated lists)' % (n, len(urls), len(cases) + sum(len(v) for v in cities.values()) + sum(len(v) for v in verticals.values()) + len(more)))
    listed = set(re.findall(r'<li><a href="([^"]+)"', main_html))
    missing = [u for u in urls if u not in listed and u != '/site-map/']
    print('sitemap URLs not listed on the page:', missing or 'none')


if __name__ == '__main__':
    main()
