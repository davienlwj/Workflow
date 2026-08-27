import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLAN_WEEKS, defaultMileagePlan, currentWeekIndex, weekDateRange, weekProgress,
} from '../vo2max/js/mileagePlan.js';

const plan = {
  startDate: '2026-08-31', // a Monday
  weeks: [
    { totalKm: 18, longRunKm: 6, note: 'Build phase' },
    { totalKm: 20, longRunKm: 7, note: '' },
    { totalKm: 22, longRunKm: 8, note: '' },
  ],
};

test('defaultMileagePlan starts on the Monday after "now" and carries the 13-week table', () => {
  const p = defaultMileagePlan(new Date('2026-08-27T09:00:00')); // a Thursday
  assert.equal(p.startDate, '2026-08-31'); // the following Monday
  assert.equal(p.weeks.length, 13);
  assert.deepEqual(p.weeks[0], DEFAULT_PLAN_WEEKS[0]);
  assert.notEqual(p.weeks, DEFAULT_PLAN_WEEKS); // a copy, not the shared const
});

test('defaultMileagePlan rolls to the next Monday even when "now" already is one', () => {
  const p = defaultMileagePlan(new Date('2026-08-31T00:00:00')); // already a Monday
  assert.equal(p.startDate, '2026-09-07');
});

test('currentWeekIndex finds the week containing "now"', () => {
  assert.equal(currentWeekIndex(plan, new Date('2026-08-31T08:00:00')), 0); // Monday of week 1
  assert.equal(currentWeekIndex(plan, new Date('2026-09-06T23:00:00')), 0); // Sunday of week 1
  assert.equal(currentWeekIndex(plan, new Date('2026-09-07T00:00:00')), 1); // Monday of week 2
  assert.equal(currentWeekIndex(plan, new Date('2026-09-14T00:00:00')), 2); // week 3
});

test('currentWeekIndex is null before the plan starts or after it ends', () => {
  assert.equal(currentWeekIndex(plan, new Date('2026-08-24T00:00:00')), null); // a week early
  assert.equal(currentWeekIndex(plan, new Date('2026-09-21T00:00:00')), null); // a week past the last one
});

test('currentWeekIndex is null for an empty/missing plan', () => {
  assert.equal(currentWeekIndex(null), null);
  assert.equal(currentWeekIndex({ startDate: '2026-08-31', weeks: [] }), null);
});

test('weekDateRange returns the Monday-to-Monday span for a given week', () => {
  const { from, to } = weekDateRange(plan, 1);
  assert.equal(from.toISOString().slice(0, 10), '2026-09-07');
  assert.equal(to.toISOString().slice(0, 10), '2026-09-14');
});

test('weekProgress sums only run-sport sessions with a distance, inside that week', () => {
  const sessions = [
    { date: '2026-08-31', sport: 'run', distanceKm: 5 },
    { date: '2026-09-02', sport: 'run', distanceKm: 6 },
    { date: '2026-09-06', sport: 'run', distanceKm: 4 }, // still week 1 (Sunday)
    { date: '2026-09-07', sport: 'run', distanceKm: 100 }, // week 2 - excluded
    { date: '2026-09-02', sport: 'ride', distanceKm: 40 }, // not a run - excluded
    { date: '2026-09-02', sport: 'run', distanceKm: null }, // no distance - excluded
  ];
  const p = weekProgress(plan, sessions, 0);
  assert.equal(p.week, 1);
  assert.equal(p.totalWeeks, 3);
  assert.equal(p.totalKm, 18);
  assert.equal(p.longRunKm, 6);
  assert.equal(p.note, 'Build phase');
  assert.equal(p.completedKm, 15);
  assert.equal(p.remainingKm, 3);
  assert.equal(p.pct, 83);
  assert.equal(p.fromISO, '2026-08-31');
  assert.equal(p.toISO, '2026-09-06');
});

test('weekProgress caps remaining at 0 and percent at 100 once the target is beaten', () => {
  const sessions = [{ date: '2026-08-31', sport: 'run', distanceKm: 30 }];
  const p = weekProgress(plan, sessions, 0);
  assert.equal(p.completedKm, 30);
  assert.equal(p.remainingKm, 0);
  assert.equal(p.pct, 100);
});

test('weekProgress returns null for an out-of-range week index', () => {
  assert.equal(weekProgress(plan, [], 99), null);
});
