import test from 'node:test';
import assert from 'node:assert/strict';
import { vo2maxTrendSVG, mileageBarChartSVG } from '../vo2max/js/chart.js';

test('vo2maxTrendSVG shows the empty state when there are no points', () => {
  assert.match(vo2maxTrendSVG([]), /No VO2max readings logged yet/);
});

test('vo2maxTrendSVG labels each point with its exact value', () => {
  const svg = vo2maxTrendSVG([
    { date: '2026-08-01', value: 46, label: 'Baseline' },
    { date: '2026-08-18', value: 47.2, label: null },
  ]);
  assert.match(svg, /<text[^>]*class="chart-value-label"[^>]*>46<\/text>/);
  assert.match(svg, /<text[^>]*class="chart-value-label"[^>]*>47\.2<\/text>/);
});

test('vo2maxTrendSVG distinguishes the baseline point (filled) from later readings (hollow)', () => {
  const svg = vo2maxTrendSVG([
    { date: '2026-08-01', value: 46, label: 'Baseline' },
    { date: '2026-08-18', value: 47, label: null },
  ]);
  assert.match(svg, /class="chart-dot chart-dot-baseline"/);
  assert.match(svg, /class="chart-dot"/);
});

test('mileageBarChartSVG shows the empty state when every bucket is zero', () => {
  const svg = mileageBarChartSVG([{ label: 'Aug', km: 0 }, { label: 'Sep', km: 0 }]);
  assert.match(svg, /No distance logged for this range yet/);
});

test('mileageBarChartSVG draws one bar per bucket, labeled with its km and period', () => {
  const svg = mileageBarChartSVG([{ label: 'Jul', km: 12.5 }, { label: 'Aug', km: 0 }]);
  assert.match(svg, /<rect[^>]*class="chart-bar"/);
  assert.match(svg, /<text[^>]*class="chart-value-label"[^>]*>12\.5<\/text>/);
  // A zero bucket gets no value label (nothing to show), but still gets its period label.
  assert.doesNotMatch(svg, /class="chart-value-label"[^>]*>0</);
  assert.match(svg, />Jul</);
  assert.match(svg, />Aug</);
});
