/*
 * Minimalist front/back body silhouette, with the worked muscle group(s)
 * for an exercise filled in solid over a plain outline. Dependency-free
 * inline SVG, in the same spirit as chart.js.
 */

const NS = 'http://www.w3.org/2000/svg';

// A static humanoid outline, identical in both views (drawn as outline-only
// shapes; the muscle regions below are drawn on top of it).
const OUTLINE = `
  <circle cx="30" cy="8" r="6"/>
  <rect x="20" y="14" width="20" height="34" rx="6"/>
  <rect x="10" y="16" width="7" height="20" rx="3"/>
  <rect x="43" y="16" width="7" height="20" rx="3"/>
  <rect x="8" y="36" width="6" height="16" rx="3"/>
  <rect x="46" y="36" width="6" height="16" rx="3"/>
  <rect x="21" y="48" width="8" height="30" rx="4"/>
  <rect x="31" y="48" width="8" height="30" rx="4"/>
`;

// Each muscle's highlighted shape(s), keyed by which view(s) it appears in.
const REGIONS = {
  shoulders: {
    front: '<circle cx="16" cy="18" r="4"/><circle cx="44" cy="18" r="4"/>',
    back: '<circle cx="16" cy="18" r="4"/><circle cx="44" cy="18" r="4"/>',
  },
  chest: { front: '<rect x="21" y="16" width="18" height="11" rx="4"/>' },
  biceps: { front: '<rect x="10.5" y="18" width="5" height="16" rx="2.5"/><rect x="44.5" y="18" width="5" height="16" rx="2.5"/>' },
  forearms: { front: '<rect x="8.5" y="37" width="5" height="14" rx="2.5"/><rect x="46.5" y="37" width="5" height="14" rx="2.5"/>' },
  abs: { front: '<rect x="23" y="29" width="14" height="16" rx="3"/>' },
  quads: { front: '<rect x="21.5" y="49" width="7" height="27" rx="3"/><rect x="31.5" y="49" width="7" height="27" rx="3"/>' },

  back: { back: '<rect x="21" y="22" width="18" height="20" rx="4"/>' },
  triceps: { back: '<rect x="10.5" y="18" width="5" height="16" rx="2.5"/><rect x="44.5" y="18" width="5" height="16" rx="2.5"/>' },
  glutes: { back: '<rect x="21" y="47" width="18" height="10" rx="4"/>' },
  hamstrings: { back: '<rect x="21.5" y="49" width="7" height="14" rx="3"/><rect x="31.5" y="49" width="7" height="14" rx="3"/>' },
  calves: { back: '<rect x="21.5" y="64" width="7" height="13" rx="3"/><rect x="31.5" y="64" width="7" height="13" rx="3"/>' },
};

function bodySVG(view, activeMuscles) {
  const highlights = activeMuscles
    .map((m) => REGIONS[m]?.[view])
    .filter(Boolean)
    .join('');
  return `<svg viewBox="0 0 60 88" class="muscle-body" xmlns="${NS}" aria-hidden="true">
    <g class="muscle-outline">${OUTLINE}</g>
    <g class="muscle-active">${highlights}</g>
  </svg>`;
}

/**
 * @param {string[]} activeMuscles muscle group ids to highlight
 * @returns {string} one body silhouette per view the active muscles need
 *   (front, back, or both), wrapped in a `.muscle-diagram` container
 */
export function muscleDiagramSVG(activeMuscles) {
  const needsFront = activeMuscles.some((m) => REGIONS[m]?.front);
  const needsBack = activeMuscles.some((m) => REGIONS[m]?.back);
  const views = [];
  if (needsFront || !needsBack) views.push(bodySVG('front', activeMuscles));
  if (needsBack) views.push(bodySVG('back', activeMuscles));
  return `<div class="muscle-diagram">${views.join('')}</div>`;
}
