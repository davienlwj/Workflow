import test from 'node:test';
import assert from 'node:assert/strict';
import { mileageTrendSVG, muscleRadarSVG } from '../vo2max/js/chart.js';
import { RADAR_GROUPS } from '../vo2max/js/exercises.js';

test('mileageTrendSVG shows the empty state when every bucket is zero', () => {
  assert.match(mileageTrendSVG([{ label: 'Aug', km: 0 }, { label: 'Sep', km: 0 }]), /No distance logged for this range yet/);
});

test('mileageTrendSVG draws one dot per bucket, joined by a line, labeled with its km and period', () => {
  const svg = mileageTrendSVG([{ label: 'Jul', km: 12.5 }, { label: 'Aug', km: 0 }]);
  assert.match(svg, /<circle[^>]*class="chart-dot"/);
  assert.match(svg, /<path[^>]*class="chart-line"/);
  assert.match(svg, /<text[^>]*class="chart-value-label"[^>]*>12\.5<\/text>/);
  // A zero bucket gets no value label (nothing to show), but still gets its period label.
  assert.doesNotMatch(svg, /class="chart-value-label"[^>]*>0</);
  assert.match(svg, />Jul</);
  assert.match(svg, />Aug</);
});

function breakdown(overrides) {
  return RADAR_GROUPS.map((muscle) => ({ muscle, sets: overrides[muscle] || 0 }));
}

test('muscleRadarSVG shows the empty state when every muscle has zero sets', () => {
  const svg = muscleRadarSVG(breakdown({}));
  assert.match(svg, /No sets logged for this range yet/);
});

test('muscleRadarSVG draws one vertex dot and label per radar group when there is data', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3, back: 2 }));
  assert.equal((svg.match(/class="chart-dot"/g) || []).length, RADAR_GROUPS.length);
  assert.match(svg, />Chest</);
  assert.match(svg, />Back</);
  assert.match(svg, /Chest: 3 sets/);
  assert.match(svg, /Back: 2 sets/);
});

test('muscleRadarSVG pluralizes the tooltip correctly for exactly one set', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 1 }));
  assert.match(svg, /Chest: 1 set</);
  assert.doesNotMatch(svg, /Chest: 1 sets/);
});

test('muscleRadarSVG closes the data polygon back to its starting point', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3, arms: 1 }));
  assert.match(svg, /d="M[^"]*Z"[^>]*class="chart-radar-fill"/);
});

test('muscleRadarSVG labels each muscle with its share of total sets logged', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3, arms: 1 })); // 4 total: 75% / 25%
  assert.match(svg, /class="chart-radar-pct">75% /);
  assert.match(svg, /class="chart-radar-pct">25% /);
  // Untouched muscles still get a 0% line rather than being left blank.
  assert.match(svg, /class="chart-radar-pct">0% /);
});

test('muscleRadarSVG tags each label with its group id for click-to-expand', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3 }));
  for (const g of RADAR_GROUPS) {
    assert.match(svg, new RegExp(`data-group="${g}"`), `no data-group for "${g}"`);
  }
});

test('muscleRadarSVG gives each label an invisible hit-target rect for a larger tap area', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3 }));
  assert.equal((svg.match(/<rect[^>]*pointer-events="all"/g) || []).length, RADAR_GROUPS.length);
});

test('muscleRadarSVG highlights only the active group\'s label', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3, arms: 1 }), 'chest'); // 4 total: chest 75%
  assert.match(svg, /class="chart-radar-label-group active" data-group="chest"/);
  assert.doesNotMatch(svg, /class="chart-radar-label-group active" data-group="back"/);
  // Expanded group shows a down-caret, the rest an up/right one.
  assert.match(svg, /class="chart-radar-pct">75% ▾<\/tspan>/);
});

test('muscleRadarSVG has no active label when activeGroup is not passed', () => {
  const svg = muscleRadarSVG(breakdown({ chest: 3 }));
  assert.doesNotMatch(svg, /chart-radar-label-group active/);
});
