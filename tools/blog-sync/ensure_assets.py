#!/usr/bin/env python3
"""Make sure every upload a post needs exists on the staging server, fetching missing ones from live.

Collects uploads referenced by: (1) current staging post bodies, (2) the clean live bodies
(bodies.json), (3) live featured images. Checks which are absent from staging's uploads folder,
then downloads those (and only those, never overwriting) straight from consultusdigital.com
onto the server.

Usage: python3 ensure_assets.py DATA_DIR            (report only)
       python3 ensure_assets.py DATA_DIR download   (fetch the missing files)
"""
import json
import re
import shlex
import subprocess
import sys
from urllib.parse import unquote

SSH = 'kinsta-staging'
UPLOADS = '/www/consultusdigital_643/public/blog/wp-content/uploads'
WP = 'cd /www/consultusdigital_643/public/blog && wp'
LIVE_UPLOADS = 'https://consultusdigital.com/wp-content/uploads/'
REF = re.compile(r'wp-content/uploads/([^"\'\s)<>?#]+)')


def ssh(cmd, stdin=None):
    r = subprocess.run(['ssh', SSH, cmd], input=stdin, capture_output=True, text=True)
    return r.stdout


def staging_contents():
    php = ('$o=[];foreach(get_posts(["post_type"=>"post","post_status"=>"any","numberposts"=>-1]) as $p)'
           '{$o[$p->ID]=$p->post_content;} echo json_encode($o);')
    out = ssh('%s eval %s 2>/dev/null' % (WP, shlex.quote(php)))
    return json.loads(out[out.index('{'):])


def main():
    data = sys.argv[1]
    download = len(sys.argv) > 2 and sys.argv[2] == 'download'
    bodies = json.load(open(data + '/bodies.json'))
    stg = staging_contents()

    refs = {}   # rel path (as written in the HTML, still percent-encoded) -> where it came from

    def add(text, origin):
        for m in REF.finditer(text or ''):
            refs.setdefault(m.group(1), origin)

    for pid, content in stg.items():
        add(content, 'staging post %s' % pid)
    for b in bodies:
        add(b['body'], 'live post %d body' % b['id'])
        if b.get('featured'):
            add(b['featured']['src'], 'live post %d featured' % b['id'])

    rels = sorted(refs)
    lines = '\n'.join(unquote(r) for r in rels)
    out = ssh('cd %s && while IFS= read -r f; do [ -f "$f" ] || printf "%%s\\n" "$f"; done' % UPLOADS, stdin=lines)
    missing_disk = set(l for l in out.split('\n') if l)
    missing = [(r, refs[r]) for r in rels if unquote(r) in missing_disk]
    print('upload paths referenced: %d | missing on staging: %d' % (len(rels), len(missing)))
    for r, o in missing[:80]:
        print('  ', unquote(r), '<-', o)

    json.dump([unquote(r) for r, _ in missing], open(data + '/missing_assets.json', 'w'))
    if not download or not missing:
        return

    script = ['set -u', 'cd %s' % shlex.quote(UPLOADS), 'fail=0']
    for r, _ in missing:
        disk = unquote(r)
        script.append(
            'mkdir -p %s && curl -sfL --max-time 180 -o %s %s && [ -s %s ] && mv %s %s || { echo "FAILED %s"; rm -f %s; }'
            % (shlex.quote(disk.rsplit('/', 1)[0]), shlex.quote(disk + '.part'), shlex.quote(LIVE_UPLOADS + r),
               shlex.quote(disk + '.part'), shlex.quote(disk + '.part'), shlex.quote(disk),
               disk.replace('"', ''), shlex.quote(disk + '.part')))
    res = subprocess.run(['ssh', SSH, 'bash -s'], input='\n'.join(script) + '\n', capture_output=True, text=True)
    failed = [l for l in res.stdout.split('\n') if l.startswith('FAILED')]
    print('downloaded: %d | failed: %d' % (len(missing) - len(failed), len(failed)))
    for l in failed:
        print('  ', l)


if __name__ == '__main__':
    main()
