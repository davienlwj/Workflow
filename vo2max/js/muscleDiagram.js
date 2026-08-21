/*
 * Front/back body silhouette, with the worked muscle group(s) for an
 * exercise filled in solid over a plain anatomical outline. Dependency-free
 * inline SVG, in the same spirit as chart.js — built from straight-edge
 * polygons (tapered limbs, a waisted torso) and ellipses (muscle bulges)
 * rather than plain boxes, for a more detailed silhouette without needing
 * hand-tuned bezier curves.
 */

const NS = 'http://www.w3.org/2000/svg';

function poly(points) {
  return `<polygon points="${points.map(([x, y]) => `${x},${y}`).join(' ')}"/>`;
}

/** Mirrors a left-side shape onto the right, reflecting x around the body's centerline (x=50). */
function mirror(points) {
  return points.map(([x, y]) => [100 - x, y]);
}

function ellipse(cx, cy, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
}

function mirrorEllipse(cx, cy, rx, ry) {
  return ellipse(100 - cx, cy, rx, ry);
}

// ---- static body outline (shared by both views) --------------------------

const TORSO = poly([
  [30, 36], [22, 50], [24, 66], [30, 90], [26, 100], [32, 112],
  [68, 112], [74, 100], [70, 90], [76, 66], [78, 50], [70, 36],
]);

const UPPER_ARM_L = [[16, 40], [12, 58], [14, 78], [24, 78], [24, 60], [26, 42]];
const FOREARM_L = [[14, 78], [12, 96], [15, 112], [23, 112], [22, 96], [24, 78]];
const THIGH_L = [[30, 112], [26, 132], [28, 156], [46, 156], [44, 132], [46, 112]];
const SHIN_L = [[28, 156], [30, 178], [32, 196], [44, 196], [42, 178], [46, 156]];

const OUTLINE = `
  ${ellipse(50, 14, 11, 13)}
  <rect x="44" y="24" width="12" height="10" rx="2"/>
  ${TORSO}
  ${poly(UPPER_ARM_L)} ${poly(mirror(UPPER_ARM_L))}
  ${poly(FOREARM_L)} ${poly(mirror(FOREARM_L))}
  ${ellipse(19, 116, 6, 8)} ${mirrorEllipse(19, 116, 6, 8)}
  ${poly(THIGH_L)} ${poly(mirror(THIGH_L))}
  ${poly(SHIN_L)} ${poly(mirror(SHIN_L))}
  ${ellipse(38, 200, 10, 5)} ${mirrorEllipse(38, 200, 10, 5)}
`;

// ---- muscle region overlays, keyed by which view(s) they appear in -------

const REGIONS = {
  shoulders: {
    front: `${ellipse(24, 42, 10, 11)}${mirrorEllipse(24, 42, 10, 11)}`,
    back: `${ellipse(24, 42, 10, 11)}${mirrorEllipse(24, 42, 10, 11)}`,
  },
  chest: {
    front: `${ellipse(40, 52, 13, 10)}${mirrorEllipse(40, 52, 13, 10)}`,
  },
  biceps: {
    front: `${ellipse(17, 58, 7, 14)}${mirrorEllipse(17, 58, 7, 14)}`,
  },
  triceps: {
    back: `${ellipse(17, 58, 7, 14)}${mirrorEllipse(17, 58, 7, 14)}`,
  },
  forearms: {
    front: `${ellipse(17, 96, 6, 13)}${mirrorEllipse(17, 96, 6, 13)}`,
  },
  abs: {
    // A 3x2 six-pack grid instead of one solid block.
    front: [66, 77, 88].flatMap((y) => [
      `<rect x="42" y="${y}" width="7" height="9" rx="2"/>`,
      `<rect x="51" y="${y}" width="7" height="9" rx="2"/>`,
    ]).join(''),
  },
  quads: {
    front: `${ellipse(36, 132, 11, 22)}${mirrorEllipse(36, 132, 11, 22)}`,
  },
  hamstrings: {
    back: `${ellipse(36, 132, 11, 22)}${mirrorEllipse(36, 132, 11, 22)}`,
  },
  calves: {
    back: `${ellipse(36, 178, 9, 15)}${mirrorEllipse(36, 178, 9, 15)}`,
  },
  back: {
    // A lat "wing" — wider at the shoulders, tapering to the waist.
    back: poly([[36, 44], [30, 60], [38, 88], [50, 94], [62, 88], [70, 60], [64, 44], [50, 38]]),
  },
  glutes: {
    back: `${ellipse(40, 104, 12, 10)}${mirrorEllipse(40, 104, 12, 10)}`,
  },
};

function bodySVG(view, activeMuscles) {
  const highlights = activeMuscles
    .map((m) => REGIONS[m]?.[view])
    .filter(Boolean)
    .join('');
  return `<svg viewBox="0 0 100 210" class="muscle-body" xmlns="${NS}" aria-hidden="true">
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
