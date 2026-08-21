/*
 * Tiny dependency-free pictograms used to tell runs and workouts apart at a
 * glance (calendar day cells, the day panel, the dashboard's recent-activity
 * feed). currentColor so callers set color via CSS.
 */

const NS = 'http://www.w3.org/2000/svg';

export function runIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 16 16" class="glyph-icon glyph-run ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <circle cx="10.3" cy="2.7" r="1.5"/>
    <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <line x1="9.6" y1="4.3" x2="7.6" y2="8"/>
      <line x1="7.6" y1="8" x2="10.8" y2="13.2"/>
      <line x1="7.6" y1="8" x2="4.6" y2="10.8"/>
      <line x1="4.6" y1="10.8" x2="5.6" y2="14"/>
      <line x1="9" y1="5.2" x2="11.6" y2="6.8"/>
    </g>
  </svg>`;
}

export function dumbbellIconSVG(extraClass = '') {
  return `<svg viewBox="0 0 16 16" class="glyph-icon glyph-workout ${extraClass}" xmlns="${NS}" aria-hidden="true">
    <rect x="0.8" y="5.6" width="2.6" height="4.8" rx="0.8"/>
    <rect x="12.6" y="5.6" width="2.6" height="4.8" rx="0.8"/>
    <rect x="3" y="6.6" width="1.8" height="2.8" rx="0.5"/>
    <rect x="11.2" y="6.6" width="1.8" height="2.8" rx="0.5"/>
    <rect x="4.5" y="7.2" width="7" height="1.6" rx="0.6"/>
  </svg>`;
}
