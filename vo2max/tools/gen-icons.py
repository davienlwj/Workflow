#!/usr/bin/env python3
"""
Builds the HYBIRD app icons from tools/icon-source.jpg (the hand-drawn
mark), by cropping to its bounding box and re-centering it on a plain
white square at a size tuned per icon purpose:

- "any" icons (192, 512, apple-touch) can use the full canvas, so the
  mark is scaled larger for legibility.
- The maskable icon gets extra padding so the mark stays inside the
  ~80%-diameter safe circle the OS may crop adaptive icons to.

Requires Pillow and numpy (`pip install pillow numpy`).

    python3 vo2max/tools/gen-icons.py
"""

from pathlib import Path
from PIL import Image
import numpy as np

HERE = Path(__file__).resolve().parent
SRC = HERE / "icon-source.jpg"
OUT = HERE.parent / "icons"

WHITE = (255, 255, 255)
THRESHOLD = 230  # pixels darker than this count as "the mark", for the bbox scan


def mark_bbox(img):
    arr = np.array(img.convert("L"))
    ys, xs = np.where(arr < THRESHOLD)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def render(mark, canvas_size, mark_width_fraction):
    """Centers `mark` on a canvas_size x canvas_size white square, scaled so
    the mark's width is mark_width_fraction of the canvas (height follows
    the mark's own aspect ratio)."""
    target_w = round(canvas_size * mark_width_fraction)
    target_h = round(target_w * mark.height / mark.width)
    resized = mark.resize((target_w, target_h), Image.LANCZOS)
    canvas = Image.new("RGB", (canvas_size, canvas_size), WHITE)
    canvas.paste(resized, ((canvas_size - target_w) // 2, (canvas_size - target_h) // 2))
    return canvas


def to_svg_data_uri(png_path):
    import base64
    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<rect width="100" height="100" fill="#ffffff"/>'
        f'<image href="data:image/png;base64,{data}" x="0" y="0" width="100" height="100"/>'
        '</svg>'
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGB")
    bbox = mark_bbox(src)
    pad = 8  # a few px of breathing room around the scanned strokes
    l, t, r, b = bbox
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(src.width, r + pad), min(src.height, b + pad)
    mark = src.crop((l, t, r, b))
    print(f"source {src.size}, mark bbox {bbox}, cropped {mark.size}")

    # "any": bigger, since these icons aren't circle-cropped by the OS.
    render(mark, 512, 0.66).save(OUT / "icon-512.png")
    render(mark, 192, 0.66).save(OUT / "icon-192.png")
    render(mark, 180, 0.66).save(OUT / "apple-touch-icon.png")

    # "maskable": smaller, so the mark stays inside Android's ~80%-diameter
    # safe circle even after an adaptive-icon crop.
    render(mark, 512, 0.5).save(OUT / "icon-maskable-512.png")

    # Favicon: an SVG wrapper around the 192px "any" artwork (plenty for a
    # browser tab) so it scales to whatever size is requested without
    # embedding the much heavier 512px PNG.
    (OUT / "icon.svg").write_text(to_svg_data_uri(OUT / "icon-192.png"))

    print("wrote icon-512.png, icon-192.png, apple-touch-icon.png, icon-maskable-512.png, icon.svg")


if __name__ == "__main__":
    main()
