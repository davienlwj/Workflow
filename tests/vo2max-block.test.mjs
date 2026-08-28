import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysSinceLastSession, averageSessionHR,
  mileageBuckets, totalMileage,
  parsePaceMinKm, formatPaceMinKm,
} from '../vo2max/js/block.js';

test('parsePaceMinKm reads "m:ss" pace text into decimal minutes/km', () => {
  assert.equal(parsePaceMinKm('5:25'), 5 + 25 / 60);
  assert.equal(parsePaceMinKm('5:00'), 5);
  assert.equal(parsePaceMinKm('12:05'), 12 + 5 / 60);
});

test('parsePaceMinKm accepts a single-digit seconds part and a lone minutes value', () => {
  assert.equal(parsePaceMinKm('5:5'), 5 + 5 / 60);
  assert.equal(parsePaceMinKm('5'), 5);
  assert.equal(parsePaceMinKm('5.5'), 5.5);
});

test('parsePaceMinKm returns null for empty or unparseable input', () => {
  assert.equal(parsePaceMinKm(''), null);
  assert.equal(parsePaceMinKm(null), null);
  assert.equal(parsePaceMinKm(undefined), null);
  assert.equal(parsePaceMinKm('abc'), null);
});

test('formatPaceMinKm renders decimal minutes/km as "m:ss"', () => {
  assert.equal(formatPaceMinKm(5.5), '5:30');
  assert.equal(formatPaceMinKm(5 + 25 / 60), '5:25');
  assert.equal(formatPaceMinKm(12), '12:00');
});

test('formatPaceMinKm returns an empty string for null (no pace logged)', () => {
  assert.equal(formatPaceMinKm(null), '');
});

test('parsePaceMinKm and formatPaceMinKm round-trip', () => {
  assert.equal(formatPaceMinKm(parsePaceMinKm('5:25')), '5:25');
  assert.equal(parsePaceMinKm(formatPaceMinKm(5.5)), 5.5);
});

test('daysSinceLastSession looks at the most recent date', () => {
  const sessions = [{ date: '2026-08-01' }, { date: '2026-08-10' }];
  assert.equal(daysSinceLastSession(sessions, '2026-08-15'), 5);
  assert.equal(daysSinceLastSession([]), null);
});

test('averageSessionHR pools the unified avgHR field across all sessions', () => {
  const sessions = [{ avgHR: 180 }, { avgHR: 182 }, { avgHR: 176 }];
  assert.equal(averageSessionHR(sessions), Math.round((180 + 182 + 176) / 3));
  assert.equal(averageSessionHR([]), null);
});

test('averageSessionHR also pools per-interval avgHR from older interval sessions', () => {
  const sessions = [
    { intervals: [{ avgHR: 180 }, { avgHR: 182 }] },
    { intervals: [{ avgHR: 176 }] },
  ];
  assert.equal(averageSessionHR(sessions), Math.round((180 + 182 + 176) / 3));
});

test('averageSessionHR pools both the unified field and legacy per-interval readings together', () => {
  const sessions = [{ avgHR: 200 }, { intervals: [{ avgHR: 100 }] }];
  assert.equal(averageSessionHR(sessions), 150);
});


test('mileageBuckets(week) sums distance within each Monday-start week, ignoring non-run sessions', () => {
  const now = new Date('2026-08-19T00:00:00'); // Wednesday
  const sessions = [
    { date: '2026-08-17', distanceKm: 5 }, // Monday, this week
    { date: '2026-08-19', distanceKm: 3 }, // Wednesday, this week (today)
    { date: '2026-08-10', distanceKm: 10 }, // Monday, previous week
    { date: '2026-08-18', distanceKm: null }, // e.g. an interval session — excluded
  ];
  const buckets = mileageBuckets(sessions, 'week', now);
  assert.equal(buckets.length, 8); // always 8 weeks, oldest to newest
  assert.equal(buckets[7].km, 8); // this week: 5 + 3
  assert.equal(buckets[6].km, 10); // previous week
  assert.equal(buckets[0].km, 0); // 7 weeks back: no data
});

test('mileageBuckets(month) sums distance per calendar month, last 6 months', () => {
  const now = new Date('2026-08-19T00:00:00');
  const sessions = [
    { date: '2026-08-05', distanceKm: 4 },
    { date: '2026-08-12', distanceKm: 6 },
    { date: '2026-07-15', distanceKm: 20 },
    { date: '2025-08-01', distanceKm: 999 }, // over a year back, outside the 6-month window
  ];
  const buckets = mileageBuckets(sessions, 'month', now);
  assert.equal(buckets.length, 6);
  assert.deepEqual(buckets.map((b) => b.label), ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  assert.equal(buckets[5].km, 10); // Aug: 4 + 6
  assert.equal(buckets[4].km, 20); // Jul
});

test('mileageBuckets(year) sums distance per calendar year and always includes the current year', () => {
  const now = new Date('2026-08-19T00:00:00');
  const sessions = [
    { date: '2026-01-10', distanceKm: 5 },
    { date: '2025-06-01', distanceKm: 8 },
  ];
  const buckets = mileageBuckets(sessions, 'year', now);
  assert.deepEqual(buckets.map((b) => b.label), ['2025', '2026']);
  assert.equal(buckets[0].km, 8);
  assert.equal(buckets[1].km, 5);
});

test('mileageBuckets(year) still reports the current year when there is no data at all', () => {
  const buckets = mileageBuckets([], 'year', new Date('2026-08-19T00:00:00'));
  assert.deepEqual(buckets, [{ label: '2026', km: 0 }]);
});

test('totalMileage sums distanceKm across all sessions that have it', () => {
  const sessions = [{ distanceKm: 5 }, { distanceKm: 3.2 }, { distanceKm: null }, {}];
  assert.equal(totalMileage(sessions), 8.2);
  assert.equal(totalMileage([]), 0);
});
