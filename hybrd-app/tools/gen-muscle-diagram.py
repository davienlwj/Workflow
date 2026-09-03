#!/usr/bin/env python3
"""
Builds the Workout tab's muscle-diagram image assets from
tools/muscle-chart-source.jpg (a front+back anatomy illustration):

1. Splits the source into a front-view and back-view crop.
2. Recolors both from dark charcoal to a lighter grey (transparent
   background), as the neutral "unworked" body.
3. For each muscle group, finds its region(s) in the source by
   connected-component labeling seeded at a handful of hand-picked
   points (MUSCLE_SEEDS below — one point per anatomical sub-shape in
   the source illustration), then writes a transparent orange overlay PNG
   for just that region. The app stacks the base body image with
   whichever overlay(s) an exercise's muscles call for.

Requires Pillow, numpy and scipy (`pip install pillow numpy scipy`).

    python3 hybrd-app/tools/gen-muscle-diagram.py
"""

from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
SRC = HERE / "muscle-chart-source.jpg"
OUT = HERE.parent / "icons" / "muscles"

DARK_THRESHOLD = 150   # pixels darker than this are "muscle fill" for labeling/recoloring
BG_THRESHOLD = 235      # pixels lighter than this are background -> made transparent
HIGHLIGHT = (255, 108, 45)     # highlight color for a worked muscle (brand orange, #FF6C2D)

# (x0, x1, y0, y1) crop box for each view, in source-image pixel coordinates.
VIEWS = {
    "front": (22, 470, 55, 924),
    "back": (510, 957, 55, 924),
}

# Seed points (source-image pixel coordinates) for each muscle, per view.
# Each seed lands inside one connected dark sub-shape in the source
# illustration; every seed listed for a muscle is unioned into its mask.
MUSCLE_SEEDS = {
    "front": {
        "chest": [(208, 254), (284, 254)],
        "shoulders": [(337, 234), (155, 234)],
        "biceps": [(356, 304), (136, 304), (337, 307), (155, 307)],
        "forearms": [(105, 392), (387, 392)],
        "abs": [
            (225, 312), (267, 312), (228, 346), (263, 346),
            (227, 377), (265, 377), (194, 412), (298, 412),
            (230, 433), (262, 433),
        ],
        "quads": [
            (188, 543), (304, 543), (212, 532), (279, 532),
            (215, 486), (277, 486), (187, 741), (305, 741),
        ],
    },
    "back": {
        "shoulders": [(635, 235), (830, 236)],
        "back": [
            (688, 326), (778, 326), (711, 245), (754, 245),
            (714, 387), (752, 387), (674, 243), (791, 243),
        ],
        "triceps": [(634, 322), (831, 322), (633, 282), (833, 282), (663, 265), (802, 265)],
        "glutes": [(699, 478), (767, 478)],
        "hamstrings": [(790, 584), (676, 584), (769, 595), (696, 595)],
        "calves": [(668, 723), (798, 723), (692, 726), (773, 726)],
    },
}


def recolor(gray):
    """Lightens every non-background tone toward white, preserving relative
    contrast; anything already background-white becomes fully transparent."""
    out = np.where(gray < BG_THRESHOLD, BG_THRESHOLD - (BG_THRESHOLD - gray) * 0.55, 255)
    alpha = np.where(gray < BG_THRESHOLD, 255, 0).astype(np.uint8)
    rgb = np.stack([out, out, out], axis=-1).astype(np.uint8)
    return np.dstack([rgb, alpha])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src_gray = np.array(Image.open(SRC).convert("L"))
    dark_mask_full = src_gray < DARK_THRESHOLD
    labels_full, _ = ndimage.label(dark_mask_full, structure=np.ones((3, 3)))

    for view, (x0, x1, y0, y1) in VIEWS.items():
        gray_crop = src_gray[y0:y1, x0:x1]
        rgba = recolor(gray_crop.astype(np.float64))
        Image.fromarray(rgba, "RGBA").save(OUT / f"body-{view}.png", optimize=True, compress_level=9)
        print(f"{view}: body {rgba.shape[1]}x{rgba.shape[0]}")

        for muscle, seeds in MUSCLE_SEEDS[view].items():
            mask = np.zeros_like(dark_mask_full)
            for sx, sy in seeds:
                label_id = labels_full[sy, sx]
                if label_id == 0:
                    raise ValueError(f"{view}/{muscle} seed ({sx},{sy}) landed on background, not a muscle shape")
                mask |= labels_full == label_id
            crop_mask = mask[y0:y1, x0:x1]
            overlay = np.zeros((*crop_mask.shape, 4), dtype=np.uint8)
            overlay[crop_mask] = (*HIGHLIGHT, 255)
            Image.fromarray(overlay, "RGBA").save(OUT / f"{muscle}-{view}.png", optimize=True, compress_level=9)
            print(f"{view}: {muscle} mask covers {crop_mask.sum()}px")


if __name__ == "__main__":
    main()
