#!/usr/bin/env python3
"""Upload the static site and the blog theme to Kinsta, stamping every CSS/JS link with a content hash.

Why: Kinsta tells browsers to cache /assets/*.css, *.js and fonts for 10 years (Cache-Control max-age=315360000).
A changed file at the same URL never reaches a browser that already has it. So the copy of the HTML/PHP that is
uploaded gets  href="/assets/css/site.css?v=<10 hex chars of the file's SHA-1>"  on every /assets/...css|js link.
Change a file and its stamp changes, so every page asks for the new URL. The repo's own HTML is never modified.

Usage (run from anywhere; dry run by default, nothing is uploaded):
    python3 tools/kinsta/deploy_site.py              # show what would change on staging
    python3 tools/kinsta/deploy_site.py --apply      # back up the server files, upload, verify
Options:
    --skip-theme   leave the blog theme (public/blog/wp-content/themes/consultus-blog) alone
    --keep-build   keep the temporary stamped copy and print its path
    --verify-only  upload nothing: just check that staging serves the current files and stamps, and that
                   /sitemap.xml lists the page sitemap and every blog post sitemap
After uploading, Kinsta's page cache is cleared (the home page is served through PHP and Kinsta caches it,
so without this `/` keeps showing the old page).

Not touched here: the root public/index.php front controller (generated from _redirects, see
tools/kinsta/build_front_controller.py) and WordPress itself under public/blog/ (except the theme folder).
Nothing is deleted on the server except files that vanished from the theme folder.
"""
import argparse, fnmatch, hashlib, os, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SSH_HOST = 'kinsta-staging'                                  # entry in ~/.ssh/config
REMOTE_ROOT = '/www/consultusdigital_643/public'
REMOTE_THEME = REMOTE_ROOT + '/blog/wp-content/themes/consultus-blog'
REMOTE_BACKUPS = '/www/consultusdigital_643/private'
BASE_URL = 'https://stg-consultusdigital-staging.kinsta.cloud'
THEME_SRC = ROOT / 'wp-theme' / 'consultus-blog'

# Never uploaded with the site (same list as the earlier manual rsync, plus local-only files).
EXCLUDES = ['.git', '.github', '.claude', 'docs/', 'seo-migration/', 'tools/', 'wp-theme/', '*.md', '_redirects',
            'redirects.csv', '.DS_Store', '.gitignore', '*.command', 'launch-qa-report.txt',
            'consultus - website inspo - final.backup.html']
TEXT_EXT = ('.html', '.php')

# href="/assets/....css" and src="/assets/....js", with any existing ?query replaced by the stamp
ASSET_RE = re.compile(r'''\b(?P<attr>href|src)=(?P<q>["'])(?P<path>/assets/[^"'?#\s]+\.(?:css|js))(?:\?[^"'#]*)?(?P<frag>#[^"']*)?(?P=q)''')

_stamps = {}


def stamp_for(url_path):
    """10-hex-char SHA-1 of the file behind /assets/..., cached."""
    if url_path not in _stamps:
        f = ROOT / url_path.lstrip('/')
        if not f.is_file():
            raise SystemExit(f'ERROR: a page links {url_path} but {f} does not exist')
        _stamps[url_path] = hashlib.sha1(f.read_bytes()).hexdigest()[:10]
    return _stamps[url_path]


def read_exact(path):
    with open(path, encoding='utf-8', newline='') as fh:
        return fh.read()


def write_exact(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)


def stamp_text(text):
    def sub(m):
        return f'{m.group("attr")}={m.group("q")}{m.group("path")}?v={stamp_for(m.group("path"))}{m.group("frag") or ""}{m.group("q")}'
    return ASSET_RE.sub(sub, text)


def excluded(rel_parts, name):
    for pat in EXCLUDES:
        if pat.endswith('/'):
            if pat[:-1] in rel_parts:
                return True
        elif fnmatch.fnmatch(name, pat) or pat in rel_parts:
            return True
    return False


def build_site_copy(dest):
    """Stamped copy of every HTML/PHP file the site upload would send."""
    n = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = Path(dirpath).relative_to(ROOT)
        dirnames[:] = [d for d in dirnames if not excluded(rel_dir.parts + (d,), d)]
        for name in filenames:
            if not name.endswith(TEXT_EXT) or excluded(rel_dir.parts, name):
                continue
            src = Path(dirpath) / name
            out = dest / rel_dir / name
            out.parent.mkdir(parents=True, exist_ok=True)
            write_exact(out, stamp_text(read_exact(src)))
            shutil.copystat(src, out)
            n += 1
    return n


def build_theme_copy(dest):
    n = 0
    for src in THEME_SRC.rglob('*'):
        if src.is_dir():
            continue
        out = dest / src.relative_to(THEME_SRC)
        out.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == '.php':
            write_exact(out, stamp_text(read_exact(src)))
            shutil.copystat(src, out)
        else:
            shutil.copy2(src, out)
        n += 1
    return n


def normalize_permissions(folder):
    """rsync -a copies permissions, including those of the top folder: make the temporary copy 755/644 so the
    server's public/ folder can never end up with the 700 that tempfile gives its folders."""
    for dirpath, dirnames, filenames in os.walk(folder):
        os.chmod(dirpath, 0o755)
        for name in filenames:
            os.chmod(os.path.join(dirpath, name), 0o644)


def rsync(label, src, dest, dry, extra=()):
    cmd = ['rsync', '-a', '--itemize-changes'] + (['-n'] if dry else []) + list(extra) + [f'{src}/', f'{SSH_HOST}:{dest}/']
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f'rsync failed for {label} (exit {res.returncode}):\n{res.stderr}')
    changed = [l.split(' ', 1)[1].strip() for l in res.stdout.splitlines() if re.match(r'^<f', l)]
    new = [l.split(' ', 1)[1].strip() for l in res.stdout.splitlines() if re.match(r'^<f\+\+\+', l)]
    deleted = [l.split(' ', 1)[1].strip() for l in res.stdout.splitlines() if l.startswith('*deleting')]
    print(f'  {label}: {len(changed)} file(s) {"would be " if dry else ""}sent ({len(new)} new), {len(deleted)} {"would be " if dry else ""}deleted')
    for name in changed[:8]:
        print(f'      {name}')
    if len(changed) > 8:
        print(f'      ... and {len(changed) - 8} more')
    for name in deleted[:5]:
        print(f'      DELETE {name}')
    return changed


def backup_on_server():
    cmd = ("cd %s && ts=$(date +%%Y%%m%%d-%%H%%M%%S) && f=%s/backup-pre-deploy-$ts.tgz && "
           "{ find . -path ./blog -prune -o \\( -name '*.html' -o -name '*.php' \\) -print; "
           "find assets -maxdepth 2 \\( -name '*.css' -o -name '*.js' \\); echo ./blog/wp-content/themes/consultus-blog; } "
           "| tar czf $f -T - && ls -la $f") % (REMOTE_ROOT, REMOTE_BACKUPS)
    res = subprocess.run(['ssh', '-o', 'BatchMode=yes', SSH_HOST, cmd], capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit('Server backup failed, nothing was uploaded:\n' + res.stderr)
    print('  server backup: ' + res.stdout.strip().split('\n')[-1])


def purge_kinsta_cache():
    cmd = f'cd {REMOTE_ROOT}/blog && wp kinsta cache purge --all 2>&1 | grep -v -i imagick | tail -2'
    res = subprocess.run(['ssh', '-o', 'BatchMode=yes', SSH_HOST, cmd], capture_output=True, text=True)
    print('  Kinsta cache: ' + (res.stdout.strip() or res.stderr.strip() or 'no output'))


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (deploy check)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read()


def sitemap_locs(xml):
    return re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)


def check_sitemap():
    """/sitemap.xml is an index of the static pages (sitemap-pages.xml) and the blog's post sitemap (Rank Math, under /blog/).
    Every child must load and hold URLs, and every post sitemap the blog publishes must be listed in /sitemap.xml:
    if the blog ever outgrows one file (post-sitemap1.xml, post-sitemap2.xml ...), the posts in the unlisted files
    would never reach Search Console. Children are fetched from BASE_URL by path, because the file names the
    production domain."""
    try:
        status, body = fetch(BASE_URL + '/sitemap.xml')
        text = body.decode('utf-8', 'replace')
        kids = [urlparse(u).path for u in sitemap_locs(text)]
        ok = status == 200 and '<sitemapindex' in text and len(kids) > 0
    except Exception as e:
        print(f'  BAD /sitemap.xml ({str(e)[:60]})')
        return 1
    bad = 0 if ok else 1
    print(f'  {"ok " if ok else "BAD"} /sitemap.xml is a sitemap index of {len(kids)} sitemaps')
    for path in kids:
        try:
            status, body = fetch(BASE_URL + path)
            n = len(sitemap_locs(body.decode('utf-8', 'replace')))
            ok = status == 200 and n > 0
        except Exception as e:
            ok, n = False, str(e)[:60]
        bad += not ok
        print(f'  {"ok " if ok else "BAD"} sitemap.xml lists {path} ({n} URLs)')
    try:
        _, body = fetch(BASE_URL + '/blog/sitemap_index.xml')
        posts = [urlparse(u).path for u in sitemap_locs(body.decode('utf-8', 'replace')) if '/post-sitemap' in u]
    except Exception:
        posts = []
    missing = [p for p in posts if p not in kids]
    ok = bool(posts) and not missing
    bad += not ok
    print(f'  {"ok " if ok else "BAD"} every blog post sitemap ({", ".join(posts) or "none found"}) is listed in /sitemap.xml'
          + (f', MISSING: {", ".join(missing)}' if missing else ''))
    # Not a failure on staging, a reminder for launch: WordPress still has an http:// address here, so its sitemap does too.
    for path in posts:
        try:
            _, body = fetch(BASE_URL + path)
            urls = sitemap_locs(body.decode('utf-8', 'replace'))
        except Exception:
            continue
        plain = [u for u in urls if u.startswith('http://')]
        if plain:
            print(f'  note {path}: {len(plain)} of {len(urls)} URLs start with http:// (set the WordPress address to https://consultusdigital.com/blog before launch)')
    return bad


def verify():
    print('Verifying on staging:')
    bad = 0
    for path, stamp in sorted(_stamps.items()):
        url = f'{BASE_URL}{path}?v={stamp}'
        try:
            status, body = fetch(url)
            ok = status == 200 and hashlib.sha1(body).hexdigest()[:10] == stamp
        except Exception as e:
            ok, status = False, str(e)[:60]
        bad += not ok
        print(f'  {"ok " if ok else "BAD"} {path}?v={stamp}  ({status})')
    for page, needle in (('/', '/assets/css/site.css?v=' + stamp_for('/assets/css/site.css')), ('/cro/', '/assets/css/service.css?v=' + stamp_for('/assets/css/service.css'))):
        try:
            status, body = fetch(BASE_URL + page)
            ok = status == 200 and needle.encode() in body
        except Exception as e:
            ok, status = False, str(e)[:60]
        bad += not ok
        print(f'  {"ok " if ok else "BAD"} {page} links {needle}')
    return bad + check_sitemap()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--apply', action='store_true', help='really upload (default is a dry run)')
    ap.add_argument('--skip-theme', action='store_true')
    ap.add_argument('--keep-build', action='store_true')
    ap.add_argument('--verify-only', action='store_true')
    args = ap.parse_args()
    dry = not args.apply
    if args.verify_only:
        for path in ('/assets/css/site.css', '/assets/css/service.css', '/assets/css/case-study-shell.css', '/assets/css/city-page.css', '/assets/css/division.css',
                     '/assets/css/industry-template.css', '/assets/fonts.css', '/assets/division.js', '/assets/mobile-nav.js', '/assets/zoho-form.js'):
            stamp_for(path)
        sys.exit(1 if verify() else 0)

    tmp = Path(tempfile.mkdtemp(prefix='consultus-deploy-'))
    site_build, theme_build = tmp / 'site', tmp / 'theme'
    try:
        n_pages = build_site_copy(site_build)
        n_theme = build_theme_copy(theme_build) if not args.skip_theme else 0
        for built in (site_build, theme_build):
            if built.exists():
                normalize_permissions(built)
        print(f'{"DRY RUN" if dry else "APPLY"} -> {SSH_HOST}:{REMOTE_ROOT}')
        print(f'Stamped {n_pages} HTML/PHP file(s)' + (f' and {n_theme} theme file(s)' if not args.skip_theme else '') + '. Version stamps:')
        for path, stamp in sorted(_stamps.items()):
            print(f'  {path}?v={stamp}')
        excl = [x for p in EXCLUDES for x in ('--exclude', p)]
        if not dry:
            backup_on_server()
        print('Site:')
        rsync('assets, images, CSS, JS, other non-page files', ROOT, REMOTE_ROOT, dry, excl + ['--exclude', '*.html', '--exclude', '*.php'])
        rsync('pages (stamped HTML/PHP)', site_build, REMOTE_ROOT, dry, ['--checksum'])
        if not args.skip_theme:
            print('Blog theme:')
            rsync('theme files (stamped)', theme_build, REMOTE_THEME, dry, ['--checksum', '--delete'])
        if dry:
            print('\nDry run only: nothing was uploaded. Add --apply to upload.')
        else:
            purge_kinsta_cache()
            bad = verify()
            print('\nDone.' if not bad else f'\nFinished with {bad} failed check(s), look above.')
            sys.exit(1 if bad else 0)
    finally:
        if args.keep_build:
            print('Build kept at', tmp)
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
