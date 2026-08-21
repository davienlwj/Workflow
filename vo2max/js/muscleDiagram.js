/*
 * Front/back body diagram, built from image assets in icons/muscles/
 * (see tools/gen-muscle-diagram.py): a recolored anatomy illustration as
 * the base "unworked" body, with a transparent red overlay stacked on top
 * per worked muscle region. Each view only renders if at least one active
 * muscle has an overlay for it.
 */

const BASE = './icons/muscles';

// Which view(s) each muscle group has an overlay image for.
const VIEWS_FOR = {
  chest: ['front'],
  shoulders: ['front', 'back'],
  biceps: ['front'],
  forearms: ['front'],
  abs: ['front'],
  quads: ['front'],
  back: ['back'],
  triceps: ['back'],
  glutes: ['back'],
  hamstrings: ['back'],
  calves: ['back'],
};

function bodyHTML(view, activeMuscles) {
  const overlays = activeMuscles
    .filter((m) => VIEWS_FOR[m]?.includes(view))
    .map((m) => `<img class="muscle-overlay" src="${BASE}/${m}-${view}.png" alt="">`)
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
  const needsFront = activeMuscles.some((m) => VIEWS_FOR[m]?.includes('front'));
  const needsBack = activeMuscles.some((m) => VIEWS_FOR[m]?.includes('back'));
  const views = [];
  if (needsFront || !needsBack) views.push(bodyHTML('front', activeMuscles));
  if (needsBack) views.push(bodyHTML('back', activeMuscles));
  return `<div class="muscle-diagram">${views.join('')}</div>`;
}
