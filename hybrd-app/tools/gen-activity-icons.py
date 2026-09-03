#!/usr/bin/env python3
"""
Traces tools/icon-run-source.jpg (the user-provided reference icon) into a
solid SVG path, normalized to a 0..24 viewBox, and writes it into
js/icons.js's RUN_PATH_D so the app can render it as currentColor-able
inline SVG.

The source image is a thin outline glyph (a stroke tracing the runner's
pose, not a filled silhouette) - tracing it verbatim with potrace and
rendering under fill-rule="evenodd" reproduces that same hollow-outline
look, which reads much lighter/smaller than a solid shape at the tiny
sizes this icon renders at in the app (calendar cells, the legend, the
activity feed). So instead this script keeps only the *outer* (positive-
wound) contours potrace finds - the boundary of the ink itself - and
discards every hole contour (the enclosed white space inside the stroke,
e.g. inside the head ring), unioning the outer contours with shapely.
That fills in the same pose/silhouette as one solid shape.

DUMBBELL_PATH_D is NOT written by this script: js/icons.js hand-draws it
directly as plain bar-and-plates rectangles (see that file's header
comment) rather than tracing tools/icon-dumbbell-source.jpg, since a
literal thin-outline dumbbell has much less "ink" than a person silhouette
and a simple geometric shape reads clearer at icon sizes than this trace-
and-fill technique would for that particular source image. Re-run this
script's logic against icon-dumbbell-source.jpg (swap the filename below)
if that's ever worth revisiting.

Requires Pillow, numpy, potracer and shapely
(`pip install pillow numpy potracer shapely`; potracer imports as `potrace`).

    python3 hybrd-app/tools/gen-activity-icons.py
"""

import re
from pathlib import Path as FsPath
import numpy as np
from PIL import Image
import potrace
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = FsPath(__file__).resolve().parent
APP_JS_ICONS = HERE.parent / "js" / "icons.js"
DARK_THRESHOLD = 128
VIEWBOX = 24
BEZIER_STEPS = 14          # points sampled per curve segment, for the shapely polygon ops
SIMPLIFY_TOLERANCE = 2.0   # in source-pixel units, applied before normalizing into VIEWBOX


def _flatten_curve(curve):
    """potrace curve -> list of (x, y) points, sampling bezier segments so
    shapely has an actual polygon to do contour/union math on."""
    pts = [(curve.start_point.x, curve.start_point.y)]
    p0 = curve.start_point
    for seg in curve.segments:
        if seg.is_corner:
            pts.append((seg.c.x, seg.c.y))
            pts.append((seg.end_point.x, seg.end_point.y))
            p0 = seg.end_point
        else:
            c1, c2, p1 = seg.c1, seg.c2, seg.end_point
            for i in range(1, BEZIER_STEPS + 1):
                t = i / BEZIER_STEPS
                mt = 1 - t
                x = (mt ** 3) * p0.x + 3 * (mt ** 2) * t * c1.x + 3 * mt * (t ** 2) * c2.x + (t ** 3) * p1.x
                y = (mt ** 3) * p0.y + 3 * (mt ** 2) * t * c1.y + 3 * mt * (t ** 2) * c2.y + (t ** 3) * p1.y
                pts.append((x, y))
            p0 = p1
    return pts


def _signed_area(pts):
    total = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def trace_filled_silhouette_d(image_path):
    gray = np.array(Image.open(image_path).convert("L")).copy()
    # JPEG compression can leave a faint dark fringe right at the image edge;
    # left alone, that traces as one giant contour spanning the whole canvas.
    # The source icons all have a wide white margin around the actual glyph,
    # so forcing a clean white border is safe here.
    gray[:3, :] = 255
    gray[-3:, :] = 255
    gray[:, :3] = 255
    gray[:, -3:] = 255
    # potrace.Bitmap inverts whatever boolean array it's given (see its
    # __init__), so passing True-where-light traces the dark (icon) pixels.
    bitmap = potrace.Bitmap(gray >= DARK_THRESHOLD)
    path = bitmap.trace()

    all_pts = []
    positives = []
    for curve in path.curves:
        pts = _flatten_curve(curve)
        all_pts.extend(pts)
        if _signed_area(pts) > 0:
            poly = Polygon(pts)
            positives.append(poly if poly.is_valid else poly.buffer(0))
    filled = unary_union(positives)

    # Normalize using the FULL traced bounding box (outer + hole contours
    # together), so the filled shape sits at the same position/scale the
    # hollow-outline trace would have.
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = VIEWBOX / max(x1 - x0, y1 - y0)
    # Center the shorter axis within the square viewBox instead of pinning it
    # to 0, so an icon that isn't square (a tall runner) doesn't hug one edge.
    pad_x = (VIEWBOX - (x1 - x0) * scale) / 2
    pad_y = (VIEWBOX - (y1 - y0) * scale) / 2

    def norm(pt):
        # potrace's y axis already increases downward, matching the source
        # image's row order and SVG's coordinate system, so no flip needed.
        x = pad_x + (pt[0] - x0) * scale
        y = pad_y + (pt[1] - y0) * scale
        return round(x, 2), round(y, 2)

    polys = [filled] if filled.geom_type == "Polygon" else list(filled.geoms)
    parts = []
    for poly in polys:
        # Simplify in source-pixel space (before normalizing) so the
        # tolerance scales with the tracer's own precision - this thins out
        # the large number of near-collinear points bezier-flattening
        # produces, without visibly changing the silhouette at icon sizes.
        simplified = poly.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        ext = [norm(p) for p in simplified.exterior.coords]
        parts.append("M" + " L".join(f"{x},{y}" for x, y in ext) + " Z")
    return " ".join(parts)


def replace_between(text, start_marker, end_marker, new_body):
    pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL)
    replacement = f"{start_marker}{new_body}{end_marker}"
    if not pattern.search(text):
        raise ValueError(f"markers not found: {start_marker!r} .. {end_marker!r}")
    return pattern.sub(replacement, text, count=1)


def main():
    run_d = trace_filled_silhouette_d(HERE / "icon-run-source.jpg")

    js = APP_JS_ICONS.read_text()
    js = replace_between(js, "RUN_PATH_D = '", "'", run_d)
    APP_JS_ICONS.write_text(js)
    print(f"wrote filled-silhouette RUN_PATH_D into {APP_JS_ICONS}")


if __name__ == "__main__":
    main()
