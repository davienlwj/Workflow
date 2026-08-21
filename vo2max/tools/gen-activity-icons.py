#!/usr/bin/env python3
"""
Traces tools/icon-run-source.jpg and tools/icon-dumbbell-source.jpg (the
user-provided reference icons) into clean SVG path data, normalized to a
0..24 viewBox, and writes the two <path> `d` strings into js/icons.js so
the app can render them as currentColor-able inline SVG.

Requires Pillow, numpy and potracer (`pip install pillow numpy potracer`,
importing as `potrace`).

    python3 vo2max/tools/gen-activity-icons.py
"""

import re
from pathlib import Path as FsPath
import numpy as np
from PIL import Image
import potrace

HERE = FsPath(__file__).resolve().parent
APP_JS_ICONS = HERE.parent / "js" / "icons.js"
DARK_THRESHOLD = 128
VIEWBOX = 24


def trace_to_path_d(image_path):
    gray = np.array(Image.open(image_path).convert("L")).copy()
    # JPEG compression can leave a faint dark fringe right at the image edge;
    # left alone, that traces as one giant contour spanning the whole canvas
    # (and, under fill-rule="evenodd", inverts the icon to a black square
    # with the glyph punched out of it). The source icons all have a wide
    # white margin around the actual glyph, so forcing a clean white border
    # is safe here.
    gray[:3, :] = 255
    gray[-3:, :] = 255
    gray[:, :3] = 255
    gray[:, -3:] = 255
    # potrace.Bitmap inverts whatever boolean array it's given (see its
    # __init__), so passing True-where-light traces the dark (icon) pixels.
    bitmap = potrace.Bitmap(gray >= DARK_THRESHOLD)
    path = bitmap.trace()

    # Tight bounding box across every curve's points, to normalize into VIEWBOX.
    xs, ys = [], []
    for curve in path.curves:
        xs.append(curve.start_point.x)
        ys.append(curve.start_point.y)
        for seg in curve.segments:
            xs.append(seg.end_point.x)
            ys.append(seg.end_point.y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = VIEWBOX / max(x1 - x0, y1 - y0)
    # Center the shorter axis within the square viewBox instead of pinning it
    # to 0, so icons that aren't square (a wide dumbbell, a tall runner)
    # don't end up hugging one edge.
    pad_x = (VIEWBOX - (x1 - x0) * scale) / 2
    pad_y = (VIEWBOX - (y1 - y0) * scale) / 2

    def fmt(pt):
        # potrace's y axis already increases downward, matching the source
        # image's row order and SVG's coordinate system, so no flip needed.
        x = pad_x + (pt.x - x0) * scale
        y = pad_y + (pt.y - y0) * scale
        return f"{x:.2f},{y:.2f}"

    parts = []
    for curve in path.curves:
        parts.append(f"M{fmt(curve.start_point)}")
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{fmt(seg.c)} L{fmt(seg.end_point)}")
            else:
                parts.append(f"C{fmt(seg.c1)} {fmt(seg.c2)} {fmt(seg.end_point)}")
        parts.append("Z")
    return " ".join(parts)


def replace_between(text, start_marker, end_marker, new_body):
    pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL)
    replacement = f"{start_marker}{new_body}{end_marker}"
    if not pattern.search(text):
        raise ValueError(f"markers not found: {start_marker!r} .. {end_marker!r}")
    return pattern.sub(replacement, text, count=1)


def main():
    run_d = trace_to_path_d(HERE / "icon-run-source.jpg")
    dumbbell_d = trace_to_path_d(HERE / "icon-dumbbell-source.jpg")

    js = APP_JS_ICONS.read_text()
    js = replace_between(js, "RUN_PATH_D = '", "'", run_d)
    js = replace_between(js, "DUMBBELL_PATH_D = '", "'", dumbbell_d)
    APP_JS_ICONS.write_text(js)
    print(f"wrote traced path data into {APP_JS_ICONS}")


if __name__ == "__main__":
    main()
