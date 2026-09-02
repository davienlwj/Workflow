/*
 * Running-figure / dumbbell pictograms used to tell runs and workouts apart
 * at a glance (calendar day cells, the day panel, the dashboard's
 * recent-activity feed). currentColor'd, so callers set color via CSS.
 *
 * RUN_PATH_D is traced from tools/icon-run-source.jpg (the user-provided
 * reference icon) by tools/gen-activity-icons.py, but not verbatim: that
 * source is a thin outline glyph, and a literal trace of it renders as
 * that same hollow outline (see the script's own history / this file's
 * git log), which reads much lighter/smaller than a solid shape at the
 * tiny sizes this renders at in the app. The script instead keeps only
 * the outline's outer boundary and fills it solid, so the path below is
 * the exact same pose, just filled in - see gen-activity-icons.py to
 * regenerate it.
 * DUMBBELL_PATH_D is hand-drawn (a solid bar + plates silhouette, not
 * traced) - see gen-activity-icons.py's header comment for why.
 */

const NS = 'http://www.w3.org/2000/svg';

// Filled silhouette traced from tools/icon-run-source.jpg - see the header
// comment above and tools/gen-activity-icons.py.
const RUN_PATH_D = 'M13.98,23.84 L13.23,23.23 L12.83,22.41 L12.66,17.25 L12.54,17.2 L12.06,19.35 L11.77,20.04 L11.22,20.45 L10.11,20.43 L3.96,19.05 L3.38,18.62 L2.93,17.98 L2.82,16.6 L2.96,16.05 L3.38,15.47 L4.52,14.85 L5.33,14.83 L8.14,15.35 L8.39,14.01 L7.39,13.91 L6.73,13.64 L6.2,13.18 L5.78,12.41 L5.68,7.18 L11.61,4.74 L11.29,3.69 L11.25,2.91 L11.48,1.95 L11.91,1.19 L12.63,0.5 L13.62,0.0 L15.06,0.01 L15.91,0.25 L16.76,0.85 L17.36,1.67 L17.69,2.7 L17.63,3.91 L17.28,4.8 L16.67,5.54 L15.81,6.13 L16.82,7.78 L17.51,8.57 L18.49,9.17 L20.02,9.73 L20.66,10.22 L21.15,11.07 L21.18,12.16 L21.03,12.73 L20.57,13.35 L19.93,13.76 L19.34,13.9 L17.55,13.59 L15.3,12.6 L15.36,12.83 L17.22,14.72 L17.19,22.41 L16.65,23.33 L15.88,23.9 L14.54,24.0 L13.98,23.84 Z';

export function runIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 24 24" class="glyph-icon glyph-run ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <path d="${RUN_PATH_D}" fill="currentColor"/>
  </svg>`;
}

// Hand-drawn solid dumbbell: a thin center bar, two tall weight plates, and
// two small end caps, all as plain non-overlapping rectangles so the single
// filled path reads as one bold silhouette (no traced outline/holes).
const DUMBBELL_PATH_D = 'M7,10.5 L17,10.5 L17,13.5 L7,13.5 Z M3,2 L7,2 L7,22 L3,22 Z M17,2 L21,2 L21,22 L17,22 Z M0,7 L3,7 L3,17 L0,17 Z M21,7 L24,7 L24,17 L21,17 Z';

export function dumbbellIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 24 24" class="glyph-icon glyph-workout ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <path d="${DUMBBELL_PATH_D}" fill="currentColor" fill-rule="evenodd"/>
  </svg>`;
}

// Plain stroke-based double-headed arrow (bar + two arrowheads), used for
// the "swap exercise" button. Drawn as strokes rather than reusing a
// Unicode arrow character - some platforms render arrow codepoints via a
// color emoji fallback font even with a text-presentation selector, which
// looks out of place next to the app's flat monochrome icon buttons.
export function swapIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 24 24" class="glyph-icon glyph-swap ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <path d="M4,12 L20,12 M4,12 L8,8 M4,12 L8,16 M20,12 L16,8 M20,12 L16,16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// Hand-drawn pennant flag on a pole (solid pole rect + solid triangular
// flag) - the mileage plan's target race day marker on the calendar, the
// same "simple solid shape" treatment as the dumbbell icon above rather
// than a traced outline.
export function raceFlagIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 24 24" class="glyph-icon glyph-race ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <path d="M4,1 L6,1 L6,23 L4,23 Z M6,3 L20,6.5 L6,10 Z" fill="currentColor" fill-rule="evenodd"/>
  </svg>`;
}
