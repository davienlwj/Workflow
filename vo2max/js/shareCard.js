/*
 * Renders a workout as one of three shareable PNGs - a translucent stat
 * card floating on a fully transparent canvas, the same shape as
 * Strava's own "share to Instagram Stories" card: drop it straight onto
 * a story as a sticker and whatever photo/background is already there
 * shows through around it. Pure rendering only - the caller (app.js)
 * assembles each card's data from the same pure functions the in-app
 * summary/muscle-balance/exercise sheets already use.
 *
 * All text uses textBaseline "top" and stacks by simple, explicit line
 * heights (fontSize * ~1.2) rather than baseline-to-baseline offsets -
 * far less error-prone than hand-computing ascent/descent clearance
 * between lines of very different sizes (a small label directly above a
 * large stat number, say).
 */

import { MUSCLE_META } from './muscleDiagram.js';

const W = 1080;
const H = 1920;
const PAD_X = 80;

const BRAND_ORANGE = '#FF6C2D';
const INK = '#f5f5f5';
const DIM = '#9a9a9a';
const DIMMER = '#6b6b6b';
const PANEL_FILL = 'rgba(12, 12, 12, 0.82)';
const PANEL_BORDER = 'rgba(255, 255, 255, 0.10)';
const LINE = 'rgba(255, 255, 255, 0.14)';
// Falls back to a monospace-ish stack (matching the app's own --font-mono)
// if Space Mono somehow isn't loaded yet, rather than an arbitrary serif.
const FONT_STACK = '"Space Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const MAX_EXERCISE_ROWS = 7;

const MUSCLE_ICON_BASE = './icons/muscles';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function ensureFontLoaded() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Space Mono"`),
      document.fonts.load(`400 40px "Space Mono"`),
    ]);
  } catch {
    // Falls back to FONT_STACK's next family if Space Mono somehow isn't
    // available - still renders, just not pixel-perfect to the app.
  }
}

/** Milliseconds -> "1h 12m" / "42m" for the card's big duration line -
 *  fmtElapsed's "mm:ss" reads as a stopwatch, not a summary stat. */
function fmtDurationWords(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function font(weight, size) {
  return `${weight} ${size}px ${FONT_STACK}`;
}

/** Draws one line of centered text at the given top-y, returns the y just
 *  below it (top-y + this line's height) for the next element to start at. */
function line(ctx, text, cx, topY, { weight = 400, size, color, lineHeight = 1.2 }) {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, cx, topY);
  return topY + size * lineHeight;
}

/**
 * @param {{
 *   workoutName: string|null,
 *   dateLabel: string,
 *   durationMs: number|null,
 *   totalVolume: number,
 *   exerciseRows: {name: string, setCount: number, totalReps: number, volume: number}[],
 *   newPRs: {name: string, weight: number}[],
 * }} data
 * @returns {Promise<Blob>} a transparent 1080x1920 PNG
 */
export async function renderWorkoutShareCard(data) {
  await ensureFontLoaded();
  const logo = await loadImage('./icons/logo-header.png');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Canvas starts fully transparent - never paint the whole surface, only
  // the panel itself, so the exported PNG sits cleanly on any background.

  const totalSets = data.exerciseRows.reduce((sum, r) => sum + r.setCount, 0);
  const shownRows = data.exerciseRows.slice(0, MAX_EXERCISE_ROWS);
  const hiddenCount = data.exerciseRows.length - shownRows.length;
  const hasPRs = data.newPRs.length > 0;
  // Only a workout finished through the live timer has a known duration -
  // one logged directly for a past date, or opened for share long after it
  // was saved before this field existed, has none: skip the section rather
  // than showing a bogus 0m/NaN.
  const hasDuration = data.durationMs != null;

  const logoH = 72;
  const logoW = logoH * (logo.width / logo.height);

  // ---- pass 1: walk the content top-down purely to measure its total
  // height, so the panel can be sized to fit it with even padding. A
  // scratch y-cursor is enough; nothing is drawn in this pass. ----
  const measure = () => {
    let y = 64; // top padding
    y += logoH + 40;
    y += 26 * 1.3 + 16; // "WORKOUT COMPLETE"
    y += 46 * 1.25 + 12; // workout name
    y += 26 * 1.3 + 40; // date
    if (hasPRs) {
      y += 30 * 1.3 + 8;
      y += data.newPRs.length * (28 * 1.3);
      y += 28;
    }
    if (hasDuration) {
      y += 22 * 1.3 + 8; // "DURATION" label
      y += 84 * 1.15 + 40; // big duration value
    }
    y += 44 * 1.15 + 20 * 1.2 + 40; // stat row (value + label)
    y += 1 + 32; // divider
    y += shownRows.length * 76;
    if (hiddenCount > 0) y += 34;
    y += 56; // bottom padding
    return y;
  };
  const contentH = measure();
  const panelX = PAD_X;
  const panelW = W - PAD_X * 2;
  const innerX = panelX + 56;
  const innerW = panelW - 112;
  const panelH = Math.min(contentH, H - 160);
  const panelY = (H - panelH) / 2;

  ctx.fillStyle = PANEL_FILL;
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.fill();
  ctx.stroke();

  // ---- pass 2: draw, following the exact same flow as the measure pass ----
  const cx = W / 2;
  let y = panelY + 64;

  ctx.drawImage(logo, cx - logoW / 2, y, logoW, logoH);
  y += logoH + 40;

  y = line(ctx, 'WORKOUT COMPLETE', cx, y, { weight: 700, size: 26, color: DIM, lineHeight: 1.3 });
  y += 16;
  y = line(ctx, data.workoutName || 'Workout', cx, y, { weight: 700, size: 46, color: INK, lineHeight: 1.25 });
  y += 12;
  y = line(ctx, data.dateLabel, cx, y, { weight: 400, size: 26, color: DIM, lineHeight: 1.3 });
  y += 40;

  if (hasPRs) {
    y = line(ctx, `\u{1F389} NEW PR${data.newPRs.length > 1 ? 'S' : ''}`, cx, y, { weight: 700, size: 30, color: BRAND_ORANGE, lineHeight: 1.3 });
    y += 8;
    for (const pr of data.newPRs) {
      y = line(ctx, `${pr.name}: ${pr.weight}kg`, cx, y, { weight: 400, size: 28, color: INK, lineHeight: 1.3 });
    }
    y += 28;
  }

  if (hasDuration) {
    y = line(ctx, 'DURATION', cx, y, { weight: 700, size: 22, color: DIM, lineHeight: 1.3 });
    y += 8;
    y = line(ctx, fmtDurationWords(data.durationMs), cx, y, { weight: 700, size: 84, color: BRAND_ORANGE, lineHeight: 1.15 });
    y += 40;
  }

  const stats = [
    [`${Math.round(data.totalVolume)}kg`, 'VOLUME'],
    [String(data.exerciseRows.length), 'EXERCISES'],
    [String(totalSets), 'SETS'],
  ];
  const colW = innerW / 3;
  const statTopY = y;
  for (let i = 0; i < stats.length; i++) {
    const colCx = innerX + colW * i + colW / 2;
    let sy = line(ctx, stats[i][0], colCx, statTopY, { weight: 700, size: 44, color: BRAND_ORANGE, lineHeight: 1.15 });
    line(ctx, stats[i][1], colCx, sy + 5, { weight: 700, size: 20, color: DIM, lineHeight: 1.2 });
  }
  y = statTopY + 44 * 1.15 + 5 + 20 * 1.2 + 40;

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();
  y += 32;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const row of shownRows) {
    ctx.font = font(700, 30);
    ctx.fillStyle = INK;
    ctx.fillText(row.name, innerX, y);
    ctx.font = font(400, 22);
    ctx.fillStyle = DIMMER;
    ctx.fillText(`${row.setCount} sets · ${row.totalReps} reps · ${Math.round(row.volume)}kg`, innerX, y + 38);
    y += 76;
  }
  if (hiddenCount > 0) {
    ctx.font = font(400, 24);
    ctx.fillStyle = DIMMER;
    ctx.textAlign = 'center';
    ctx.fillText(`+${hiddenCount} more exercise${hiddenCount === 1 ? '' : 's'}`, cx, y);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * @param {{
 *   workoutName: string|null,
 *   dateLabel: string,
 *   activeMuscles: string[],
 *   groupRows: {label: string, pct: number}[],
 * }} data `activeMuscles` are fine-grained MUSCLES ids (see exercises.js)
 *   with at least one set in this workout - which overlay art to draw, the
 *   same mapping muscleDiagram.js uses for the in-app body diagram.
 *   `groupRows` are the coarser RADAR_GROUPS rollup (10 regions) already
 *   sorted by share descending, for the percentage list below the diagram -
 *   a 22-row list of every fine muscle would be unreadable at this size,
 *   same reasoning as the in-app radar chart.
 * @returns {Promise<Blob>} a transparent 1080x1920 PNG
 */
export async function renderMuscleBalanceCard(data) {
  await ensureFontLoaded();
  const frontAssets = [...new Set(
    data.activeMuscles.filter((m) => MUSCLE_META[m]?.views.includes('front')).map((m) => MUSCLE_META[m].asset),
  )];
  const backAssets = [...new Set(
    data.activeMuscles.filter((m) => MUSCLE_META[m]?.views.includes('back')).map((m) => MUSCLE_META[m].asset),
  )];
  const showFront = frontAssets.length > 0 || backAssets.length === 0; // same "front is the default view" rule as muscleDiagramHTML
  const showBack = backAssets.length > 0;
  const [logo, bodyFront, bodyBack, frontOverlays, backOverlays] = await Promise.all([
    loadImage('./icons/logo-header.png'),
    showFront ? loadImage(`${MUSCLE_ICON_BASE}/body-front.png`) : null,
    showBack ? loadImage(`${MUSCLE_ICON_BASE}/body-back.png`) : null,
    Promise.all(frontAssets.map((a) => loadImage(`${MUSCLE_ICON_BASE}/${a}-front.png`))),
    Promise.all(backAssets.map((a) => loadImage(`${MUSCLE_ICON_BASE}/${a}-back.png`))),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const logoH = 72;
  const logoW = logoH * (logo.width / logo.height);
  const bodyRef = bodyFront || bodyBack;
  const bodyDrawW = 300;
  const bodyDrawH = bodyRef ? bodyDrawW * (bodyRef.height / bodyRef.width) : 0;
  const rows = data.groupRows;
  const ROW_H = 46;

  const measure = () => {
    let y = 64;
    y += logoH + 40;
    y += 26 * 1.3 + 16; // "MUSCLES WORKED"
    y += 46 * 1.25 + 12; // workout name
    y += 26 * 1.3 + 40; // date
    y += bodyDrawH + 40;
    y += rows.length * ROW_H;
    y += 56;
    return y;
  };
  const contentH = measure();
  const panelX = PAD_X;
  const panelW = W - PAD_X * 2;
  const innerX = panelX + 56;
  const innerW = panelW - 112;
  const panelH = Math.min(contentH, H - 160);
  const panelY = (H - panelH) / 2;

  ctx.fillStyle = PANEL_FILL;
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.fill();
  ctx.stroke();

  const cx = W / 2;
  let y = panelY + 64;

  ctx.drawImage(logo, cx - logoW / 2, y, logoW, logoH);
  y += logoH + 40;

  y = line(ctx, 'MUSCLES WORKED', cx, y, { weight: 700, size: 26, color: DIM, lineHeight: 1.3 });
  y += 16;
  y = line(ctx, data.workoutName || 'Workout', cx, y, { weight: 700, size: 46, color: INK, lineHeight: 1.25 });
  y += 12;
  y = line(ctx, data.dateLabel, cx, y, { weight: 400, size: 26, color: DIM, lineHeight: 1.3 });
  y += 40;

  const gap = 40;
  const totalBodyW = showBack && showFront ? bodyDrawW * 2 + gap : bodyDrawW;
  let bx = cx - totalBodyW / 2;
  if (showFront && bodyFront) {
    ctx.drawImage(bodyFront, bx, y, bodyDrawW, bodyDrawH);
    for (const overlay of frontOverlays) ctx.drawImage(overlay, bx, y, bodyDrawW, bodyDrawH);
    bx += bodyDrawW + gap;
  }
  if (showBack && bodyBack) {
    ctx.drawImage(bodyBack, bx, y, bodyDrawW, bodyDrawH);
    for (const overlay of backOverlays) ctx.drawImage(overlay, bx, y, bodyDrawW, bodyDrawH);
  }
  y += bodyDrawH + 40;

  for (const row of rows) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(700, 24);
    ctx.fillStyle = INK;
    ctx.fillText(row.label, innerX, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = BRAND_ORANGE;
    ctx.fillText(`${row.pct}%`, innerX + innerW, y);

    const barY = y + 32;
    const barH = 8;
    ctx.fillStyle = LINE;
    roundRect(ctx, innerX, barY, innerW, barH, 4);
    ctx.fill();
    ctx.fillStyle = BRAND_ORANGE;
    roundRect(ctx, innerX, barY, innerW * (row.pct / 100), barH, 4);
    ctx.fill();

    y += ROW_H;
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * @param {{
 *   workoutName: string|null,
 *   dateLabel: string,
 *   prs: {name: string, maxWeight: number, best1RM: number, isNew: boolean}[],
 * }} data one row per exercise performed in this workout, its all-time best
 *   weight/estimated 1RM (see workout.js's personalRecords) - `isNew` flags
 *   one this exact workout just set (see workout.js's newPRsInWorkout).
 * @returns {Promise<Blob>} a transparent 1080x1920 PNG
 */
export async function renderPRsCard(data) {
  await ensureFontLoaded();
  const logo = await loadImage('./icons/logo-header.png');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const logoH = 72;
  const logoW = logoH * (logo.width / logo.height);
  const ROW_H = 96;

  const measure = () => {
    let y = 64;
    y += logoH + 40;
    y += 26 * 1.3 + 16; // "PERSONAL RECORDS"
    y += 46 * 1.25 + 12; // workout name
    y += 26 * 1.3 + 40; // date
    y += 1 + 32; // divider
    y += data.prs.length ? data.prs.length * ROW_H : 26 * 1.3;
    y += 56;
    return y;
  };
  const contentH = measure();
  const panelX = PAD_X;
  const panelW = W - PAD_X * 2;
  const innerX = panelX + 56;
  const innerW = panelW - 112;
  const panelH = Math.min(contentH, H - 160);
  const panelY = (H - panelH) / 2;

  ctx.fillStyle = PANEL_FILL;
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.fill();
  ctx.stroke();

  const cx = W / 2;
  let y = panelY + 64;

  ctx.drawImage(logo, cx - logoW / 2, y, logoW, logoH);
  y += logoH + 40;

  y = line(ctx, 'PERSONAL RECORDS', cx, y, { weight: 700, size: 26, color: DIM, lineHeight: 1.3 });
  y += 16;
  y = line(ctx, data.workoutName || 'Workout', cx, y, { weight: 700, size: 46, color: INK, lineHeight: 1.25 });
  y += 12;
  y = line(ctx, data.dateLabel, cx, y, { weight: 400, size: 26, color: DIM, lineHeight: 1.3 });
  y += 40;

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();
  y += 32;

  if (data.prs.length === 0) {
    line(ctx, 'No PRs logged for these exercises yet.', cx, y, { weight: 400, size: 26, color: DIM, lineHeight: 1.3 });
  } else {
    for (const pr of data.prs) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = font(700, 30);
      ctx.fillStyle = INK;
      ctx.fillText(pr.name, innerX, y);

      if (pr.isNew) {
        const badgeText = 'NEW';
        ctx.font = font(700, 18);
        const badgeW = ctx.measureText(badgeText).width + 22;
        const badgeH = 28;
        const badgeX = innerX + innerW - badgeW;
        ctx.fillStyle = BRAND_ORANGE;
        roundRect(ctx, badgeX, y + 1, badgeW, badgeH, 14);
        ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, badgeX + badgeW / 2, y + 6);
        ctx.textAlign = 'left';
      }

      ctx.font = font(400, 22);
      ctx.fillStyle = DIMMER;
      ctx.fillText(`Best: ${pr.maxWeight}kg  ·  Est. 1RM: ${pr.best1RM}kg`, innerX, y + 38);
      y += ROW_H;
    }
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
