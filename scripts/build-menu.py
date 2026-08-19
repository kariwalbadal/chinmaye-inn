#!/usr/bin/env python3
"""Rebuild menu/pages/*.webp from menu.pdf.

Run from the repo root after replacing menu.pdf:

    python3 scripts/build-menu.py

/menu renders the menu as page images rather than embedding the PDF, because
Android Chrome hands a raw .pdf navigation to the download manager instead of
displaying it. The PDF stays at /menu.pdf for download and printing.

Needs poppler (`brew install poppler`) and Pillow.
"""
import glob, os, pathlib, re, shutil, subprocess, sys, tempfile
from PIL import Image

WIDTH, QUALITY, RENDER_DPI = 1240, 82, 220
root = pathlib.Path(__file__).resolve().parent.parent
pdf, out = root / "menu.pdf", root / "menu" / "pages"
if not pdf.exists():
    sys.exit(f"no menu.pdf at {pdf}")

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(["pdftoppm", "-r", str(RENDER_DPI), "-png", str(pdf), f"{tmp}/pg"], check=True)
    pages = sorted(glob.glob(f"{tmp}/pg-*.png"))
    if not pages:
        sys.exit("pdftoppm produced no pages")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    dims, total = set(), 0
    for i, f in enumerate(pages, 1):
        im = Image.open(f).convert("RGB")
        im.thumbnail((WIDTH, WIDTH * 4), Image.LANCZOS)
        p = out / f"p{i:02d}.webp"
        im.save(p, "WEBP", quality=QUALITY, method=6)
        dims.add(im.size)
        total += p.stat().st_size

if len(dims) != 1:
    print(f"warning: pages are not a uniform size ({dims}); check the index.html width/height", file=sys.stderr)
w, h = dims.pop()
print(f"{len(pages)} pages -> {out.relative_to(root)}  {total/1048576:.2f} MB  ({w}x{h})")

# keep the page-count and intrinsic size in index.html in step with the assets
index = root / "menu" / "index.html"
src = index.read_text()
new = re.sub(r"var N = \d+, W = \d+, H = \d+;", f"var N = {len(pages)}, W = {w}, H = {h};", src)
new = re.sub(r'(<img src="pages/p01\.webp" width=")\d+(" height=")\d+(")', rf"\g<1>{w}\g<2>{h}\g<3>", new)
if new != src:
    index.write_text(new)
    print(f"updated {index.relative_to(root)}")
