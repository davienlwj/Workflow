/*
 * Front/back body diagram, built from image assets in icons/muscles/
 * (see tools/gen-muscle-diagram.py): a recolored anatomy illustration as
 * the base "unworked" body, with a transparent red overlay stacked on top
 * per worked muscle region. Each view only renders if at least one active
 * muscle has an overlay for it.
 */

const BASE = './icons/muscles';

// The exercise library's muscle groups are finer-grained than the diagram
// artwork (e.g. three chest sub-regions, three delt heads) - several ids
// share one region's overlay image. Maps each muscle id to the asset name
// its overlay is drawn from and which view(s) it appears on.
export const MUSCLE_META = {
  'upper-chest': { asset: 'chest', views: ['front'] },
  'mid-chest': { asset: 'chest', views: ['front'] },
  'lower-chest': { asset: 'chest', views: ['front'] },
  'front-delts': { asset: 'shoulders', views: ['front'] },
  'lateral-delts': { asset: 'shoulders', views: ['front'] },
  'rear-delts': { asset: 'shoulders', views: ['back'] },
  traps: { asset: 'back', views: ['back'] },
  lats: { asset: 'back', views: ['back'] },
  'mid-back': { asset: 'back', views: ['back'] },
  'lower-back': { asset: 'back', views: ['back'] },
  biceps: { asset: 'biceps', views: ['front'] },
  triceps: { asset: 'triceps', views: ['back'] },
  forearms: { asset: 'forearms', views: ['front'] },
  abs: { asset: 'abs', views: ['front'] },
  core: { asset: 'abs', views: ['front'] },
  'side-abs': { asset: 'abs', views: ['front'] },
  quads: { asset: 'quads', views: ['front'] },
  // No dedicated inner/outer-thigh artwork exists, so both reuse the quads
  // overlay (the closest region visually) rather than showing nothing.
  abductors: { asset: 'quads', views: ['front'] },
  adductors: { asset: 'quads', views: ['front'] },
  hamstrings: { asset: 'hamstrings', views: ['back'] },
  glutes: { asset: 'glutes', views: ['back'] },
  calves: { asset: 'calves', views: ['back'] },
};

function bodyHTML(view, activeMuscles) {
  // Dedupe by asset: several active muscle ids (e.g. upper/mid/lower chest)
  // can share one overlay image, which would otherwise be stacked more than
  // once for nothing.
  const assets = new Set(
    activeMuscles
      .filter((m) => MUSCLE_META[m]?.views.includes(view))
      .map((m) => MUSCLE_META[m].asset),
  );
  const overlays = [...assets]
    .map((asset) => `<img class="muscle-overlay" src="${BASE}/${asset}-${view}.png" alt="">`)
    .join('');
  return `<div class="muscle-body">
    <img class="muscle-base" src="${BASE}/body-${view}.png" alt="">
    ${overlays}
  </div>`;
}

/**
 * @param {string[]} activeMuscles muscle group ids to highlight
 * @returns {string} one body diagram per view the active muscles need
 *   (front, back, or both), wrapped in a `.muscle-diagram` container
 */
export function muscleDiagramHTML(activeMuscles) {
  const needsFront = activeMuscles.some((m) => MUSCLE_META[m]?.views.includes('front'));
  const needsBack = activeMuscles.some((m) => MUSCLE_META[m]?.views.includes('back'));
  const views = [];
  if (needsFront || !needsBack) views.push(bodyHTML('front', activeMuscles));
  if (needsBack) views.push(bodyHTML('back', activeMuscles));
  return `<div class="muscle-diagram">${views.join('')}</div>`;
}
