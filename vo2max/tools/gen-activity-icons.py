#!/usr/bin/env python3
"""
DEPRECATED / not currently wired up to anything - js/icons.js no longer has
a RUN_PATH_D or DUMBBELL_PATH_D constant for this to write into. Both
tools/icon-run-source.jpg and tools/icon-dumbbell-source.jpg are thin
outline glyphs; tracing them (what this script does) reproduces that same
hollow-outline look, which reads much lighter/smaller than a solid
silhouette at the tiny sizes these icons render at in the app. js/icons.js
hand-draws both as solid shapes instead (see its header comment).

Kept only as a reference for trace_to_path_d()'s potrace usage and its
normalize-into-0..24-viewBox logic, in case a future icon genuinely needs
to be traced from a filled/solid source image.

Requires Pillow, numpy and potracer (`pip install pillow numpy potracer`,
importing as `potrace`).
"""

from pathlib import Path as FsPath
import numpy as np
from PIL import Image
import potrace

HERE = FsPath(__file__).resolve().parent
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


def main():
    raise SystemExit(
        "gen-activity-icons.py is deprecated: js/icons.js hand-draws both "
        "the run and dumbbell glyphs now, and no longer has a RUN_PATH_D or "
        "DUMBBELL_PATH_D constant for this script to write into. See this "
        "file's header comment."
    )


if __name__ == "__main__":
    main()
