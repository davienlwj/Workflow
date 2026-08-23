/*
 * Minimal dependency-free SVG line chart for the VO2max trend.
 * Renders a string of SVG markup; the caller drops it into innerHTML.
 */

import { RADAR_GROUP_LABEL } from './exercises.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 160;
const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 24;
const PAD_B = 24;

function fmtDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function vo2maxTrendSVG(points) {
  if (points.length === 0) {
    return '<p class="chart-empty">No VO2max readings logged yet.</p>';
  }

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, 2);
  const yLow = Math.floor(minV - span * 0.15);
  const yHigh = Math.ceil(maxV + span * 0.15);

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const x = (i) => PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - ((v - yLow) / (yHigh - yLow)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  const decimals = (yHigh - yLow) < 6 ? 1 : 0;
  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const v = yLow + ((yHigh - yLow) * i) / 3;
    const gy = y(v).toFixed(1);
    return `<line x1="${PAD_L}" y1="${gy}" x2="${W - PAD_R}" y2="${gy}" class="chart-grid" />
      <text x="${PAD_L - 6}" y="${gy}" class="chart-axis" text-anchor="end" dominant-baseline="middle">${v.toFixed(decimals)}</text>`;
  }).join('');

  const dots = points.map((p, i) => {
    const cx = x(i).toFixed(1);
    const cy = y(p.value).toFixed(1);
    const cls = p.label ? 'chart-dot chart-dot-baseline' : 'chart-dot';
    const labelY = Math.max(9, Number(cy) - 8).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${p.label ? 4 : 3}" class="${cls}">
      <title>${fmtDate(p.date)}: ${p.value} ml/kg/min${p.label ? ` (${p.label})` : ''}</title>
    </circle>
    <text x="${cx}" y="${labelY}" class="chart-value-label" text-anchor="middle">${p.value}</text>`;
  }).join('');

  const firstLabel = `<text x="${x(0).toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="start">${fmtDate(points[0].date)}</text>`;
  const lastLabel = points.length > 1
    ? `<text x="${x(points.length - 1).toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" class="chart-svg" role="img" aria-label="VO2max trend">
    ${gridLines}
    <path d="${linePath}" class="chart-line" fill="none" />
    ${dots}
    ${firstLabel}
    ${lastLabel}
  </svg>`;
}

/** Shared renderer for the two "exercise metric over time" charts (weight,
 *  volume) - near-identical to vo2maxTrendSVG by design (see that function),
 *  but factored out since both callers were being touched in the same
 *  change and adding a y-axis unit label to both by hand would've meant
 *  keeping three copies of this logic in sync.
 * @param {{date: string, value: number}[]} points oldest to newest
 * @param {{emptyMessage: string, axisLabel: string, ariaLabel: string, tooltip: (p) => string}} opts */
function exerciseLineChartSVG(points, { emptyMessage, axisLabel, ariaLabel, tooltip }) {
  if (points.length === 0) {
    return `<p class="chart-empty">${emptyMessage}</p>`;
  }

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, 2);
  const yLow = Math.floor(minV - span * 0.15);
  const yHigh = Math.ceil(maxV + span * 0.15);

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const x = (i) => PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - ((v - yLow) / (yHigh - yLow)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  const decimals = (yHigh - yLow) < 6 ? 1 : 0;
  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const v = yLow + ((yHigh - yLow) * i) / 3;
    const gy = y(v).toFixed(1);
    return `<line x1="${PAD_L}" y1="${gy}" x2="${W - PAD_R}" y2="${gy}" class="chart-grid" />
      <text x="${PAD_L - 6}" y="${gy}" class="chart-axis" text-anchor="end" dominant-baseline="middle">${v.toFixed(decimals)}</text>`;
  }).join('');

  const dots = points.map((p, i) => {
    const cx = x(i).toFixed(1);
    const cy = y(p.value).toFixed(1);
    const labelY = Math.max(9, Number(cy) - 8).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="3" class="chart-dot">
      <title>${tooltip(p)}</title>
    </circle>
    <text x="${cx}" y="${labelY}" class="chart-value-label" text-anchor="middle">${p.value}</text>`;
  }).join('');

  const firstLabel = `<text x="${x(0).toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="start">${fmtDate(points[0].date)}</text>`;
  const lastLabel = points.length > 1
    ? `<text x="${x(points.length - 1).toFixed(1)}" y="${H - 6}" class="chart-axis" text-anchor="end">${fmtDate(points[points.length - 1].date)}</text>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" class="chart-svg" role="img" aria-label="${ariaLabel}">
    <text x="2" y="12" class="chart-axis" text-anchor="start">${axisLabel}</text>
    ${gridLines}
    <path d="${linePath}" class="chart-line" fill="none" />
    ${dots}
    ${firstLabel}
    ${lastLabel}
  </svg>`;
}

/** @param {{date: string, value: number, reps: number}[]} points oldest to newest: an exercise's heaviest set per session */
export function exerciseProgressSVG(points) {
  return exerciseLineChartSVG(points, {
    emptyMessage: 'No sets logged for this exercise yet.',
    axisLabel: 'kg',
    ariaLabel: 'Exercise progress',
    tooltip: (p) => `${fmtDate(p.date)}: ${p.value}kg × ${p.reps}`,
  });
}

/** @param {{date: string, value: number}[]} points oldest to newest: an exercise's total weight x reps per session */
export function exerciseVolumeSVG(points) {
  return exerciseLineChartSVG(points, {
    emptyMessage: 'No sets logged for this exercise yet.',
    axisLabel: 'kg',
    ariaLabel: 'Exercise volume',
    tooltip: (p) => `${fmtDate(p.date)}: ${p.value}kg volume`,
  });
}

/** @param {{label: string, km: number}[]} buckets oldest to newest */
export function mileageBarChartSVG(buckets) {
  if (buckets.every((b) => b.km === 0)) {
    return '<p class="chart-empty">No distance logged for this range yet.</p>';
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxKm = Math.max(...buckets.map((b) => b.km), 1) * 1.15;

  const n = buckets.length;
  const gap = 6;
  const barW = (innerW - gap * (n - 1)) / n;
  const baseY = PAD_T + innerH;
  const yFor = (km) => baseY - (km / maxKm) * innerH;

  // Up to 8 date labels ("6 Jul", "13 Jul", ...) share the chart's width, too
  // tight to read horizontally without touching their neighbors - angling
  // them (and anchoring at the end, so each reads bottom-to-top into its
  // own tick rather than spreading past it) gives each one more effective
  // width without needing a taller chart.
  const labelY = (H - 4).toFixed(1);
  const bars = buckets.map((b, i) => {
    const x = PAD_L + i * (barW + gap);
    const y = yFor(b.km);
    const h = baseY - y;
    const cx = (x + barW / 2).toFixed(1);
    const valueLabelY = Math.max(9, y - 4).toFixed(1);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="2" class="chart-bar" />
      ${b.km > 0 ? `<text x="${cx}" y="${valueLabelY}" class="chart-value-label" text-anchor="middle">${b.km}</text>` : ''}
      <text x="${cx}" y="${labelY}" class="chart-axis" text-anchor="end" transform="rotate(40 ${cx} ${labelY})">${b.label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" class="chart-svg" role="img" aria-label="Mileage">
    <line x1="${PAD_L}" y1="${baseY}" x2="${W - PAD_R}" y2="${baseY}" class="chart-grid" />
    ${bars}
  </svg>`;
}

const RADAR_SIZE = 380;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_R = 90;
const RADAR_LABEL_R = RADAR_R + 28;

const LABEL_HIT_W = 68;
const LABEL_HIT_H = 30;

/**
 * @param {{muscle: string, sets: number}[]} breakdown one entry per muscle
 *   group (see muscleSetBreakdown)
 * @param {string|null} [activeGroup] id of the group currently expanded
 *   (its label is highlighted); each label is also tagged data-group="…"
 *   and sized with an invisible hit-target rect so the caller can wire up
 *   click-to-expand via event delegation on the container.
 */
export function muscleRadarSVG(breakdown, activeGroup = null) {
  if (breakdown.every((b) => b.sets === 0)) {
    return '<p class="chart-empty">No sets logged for this range yet.</p>';
  }

  const n = breakdown.length;
  const maxVal = Math.max(...breakdown.map((b) => b.sets), 1) * 1.15;
  const angleFor = (i) => -Math.PI / 2 + (i / n) * 2 * Math.PI;
  const pointAt = (i, r) => {
    const a = angleFor(i);
    return [RADAR_CENTER + r * Math.cos(a), RADAR_CENTER + r * Math.sin(a)];
  };

  const rings = [1 / 3, 2 / 3, 1].map((f) => {
    const pts = breakdown.map((_, i) => pointAt(i, RADAR_R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" class="chart-grid" fill="none" />`;
  }).join('');

  const spokes = breakdown.map((_, i) => {
    const [x, y] = pointAt(i, RADAR_R);
    return `<line x1="${RADAR_CENTER}" y1="${RADAR_CENTER}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="chart-grid" />`;
  }).join('');

  const dataPts = breakdown.map((b, i) => pointAt(i, (b.sets / maxVal) * RADAR_R));
  const dataPath = `${dataPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z`;

  const dots = breakdown.map((b, i) => {
    const [x, y] = dataPts[i];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="chart-dot">
      <title>${RADAR_GROUP_LABEL[b.muscle]}: ${b.sets} set${b.sets === 1 ? '' : 's'}</title>
    </circle>`;
  }).join('');

  const totalSets = breakdown.reduce((sum, b) => sum + b.sets, 0);

  const labels = breakdown.map((b, i) => {
    const a = angleFor(i);
    const [x, y] = pointAt(i, RADAR_LABEL_R);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const pct = totalSets ? Math.round((b.sets / totalSets) * 100) : 0;
    const isActive = b.muscle === activeGroup;
    const hitX = anchor === 'start' ? x - 4 : anchor === 'end' ? x - LABEL_HIT_W + 4 : x - LABEL_HIT_W / 2;
    return `<g class="chart-radar-label-group${isActive ? ' active' : ''}" data-group="${b.muscle}">
      <rect x="${hitX.toFixed(1)}" y="${(y - LABEL_HIT_H / 2).toFixed(1)}" width="${LABEL_HIT_W}" height="${LABEL_HIT_H}" fill="transparent" pointer-events="all" />
      <text text-anchor="${anchor}" class="chart-radar-label">
        <tspan x="${x.toFixed(1)}" y="${(y - 4).toFixed(1)}">${RADAR_GROUP_LABEL[b.muscle]}</tspan>
        <tspan x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" class="chart-radar-pct">${pct}% ${isActive ? '▾' : '▸'}</tspan>
      </text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${RADAR_SIZE} ${RADAR_SIZE}" xmlns="${NS}" class="chart-svg" role="img" aria-label="Muscle balance">
    ${rings}
    ${spokes}
    <path d="${dataPath}" class="chart-radar-fill" />
    <path d="${dataPath}" class="chart-line" fill="none" />
    ${dots}
    ${labels}
  </svg>`;
}
