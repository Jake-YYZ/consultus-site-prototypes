# Builds contact sheets from the qa_run.mjs screenshots so a page can be reviewed in a few images.
# usage: python3 tools/qa/make_sheets.py SRC_DIR DST_DIR page1,page2   (desktop: 3 chunks per sheet at 40%, phone: 5 at 85%)
import sys, glob, os
from PIL import Image, ImageDraw
src = sys.argv[1]; dst = sys.argv[2]; os.makedirs(dst, exist_ok=True)
slugs = sys.argv[3].split(',')
for slug in slugs:
    for w, per, scale in ((1440, 3, 0.40), (390, 5, 0.85)):
        files = sorted(glob.glob(f'{src}/{slug}-{w}-[0-9][0-9].png'))
        if not files: continue
        for si in range(0, len(files), per):
            group = files[si:si+per]
            tiles = []
            for f in group:
                im = Image.open(f).convert('RGB')
                im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
                tiles.append(im)
            gap = 8
            W = sum(t.width for t in tiles) + gap*(len(tiles)+1); H = max(t.height for t in tiles) + 2*gap + 14
            sheet = Image.new('RGB', (W, H), (60, 60, 60)); d = ImageDraw.Draw(sheet)
            x = gap
            for i, t in enumerate(tiles):
                sheet.paste(t, (x, gap+12)); d.text((x, 1), f'{slug} {w}px  part {si+i+1}/{len(files)}', fill=(255, 255, 255)); x += t.width + gap
            out = f'{dst}/{slug}-{w}-sheet{si//per+1:02d}.png'; sheet.save(out)
            print(out, sheet.size)
