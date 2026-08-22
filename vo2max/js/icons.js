/*
 * Running-figure / dumbbell pictograms used to tell runs and workouts apart
 * at a glance (calendar day cells, the day panel, the dashboard's
 * recent-activity feed). currentColor'd, so callers set color via CSS.
 *
 * Both are hand-drawn as solid silhouettes (a circle + rotated rounded
 * rects for the runner, plain rectangles for the dumbbell) rather than
 * traced from the reference JPEGs in tools/: those reference icons are
 * thin outline glyphs, and tracing them (as an earlier version of this
 * file did) reproduces that same hollow-outline look, which reads much
 * lighter/smaller than a solid silhouette at the tiny sizes these render
 * at. tools/gen-activity-icons.py is therefore unused - see its header
 * comment.
 */

const NS = 'http://www.w3.org/2000/svg';

export function runIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 24 24" class="glyph-icon glyph-run ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <circle cx="14" cy="4.2" r="2.3" fill="currentColor"/>
    <rect x="12.7" y="6.4" width="2.4" height="7.2" rx="1.2" fill="currentColor"/>
    <rect x="12" y="13.4" width="2.2" height="6.5" rx="1.1" fill="currentColor" transform="rotate(-22 13.1 13.4)"/>
    <rect x="12" y="13.4" width="2.1" height="6.8" rx="1.05" fill="currentColor" transform="rotate(38 13.1 13.4)"/>
    <rect x="12.5" y="7.2" width="1.8" height="5.2" rx="0.9" fill="currentColor" transform="rotate(-45 13.4 7.2)"/>
    <rect x="12.5" y="7.2" width="1.7" height="4.6" rx="0.85" fill="currentColor" transform="rotate(55 13.4 7.2)"/>
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
