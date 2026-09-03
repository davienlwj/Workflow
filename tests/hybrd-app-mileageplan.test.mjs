import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLAN_WEEKS, DEFAULT_RACE, defaultMileagePlan, currentWeekIndex, weekDateRange, weekProgress, daysUntilRace,
  weeksNeededForRace, resizeWeeks, defaultSplitsForWeek, weekSplits, weekSessionKm,
} from '../hybrd-app/js/mileagePlan.js';

const plan = {
  startDate: '2026-08-31', // a Monday
  weeks: [
    { totalKm: 18, longRunKm: 6, note: 'Build phase' },
    { totalKm: 20, longRunKm: 7, note: '' },
    { totalKm: 22, longRunKm: 8, note: '' },
  ],
};

test('defaultMileagePlan starts on the Monday after "now" and carries the 22-week table', () => {
  const p = defaultMileagePlan(new Date('2026-08-27T09:00:00')); // a Thursday
  assert.equal(p.startDate, '2026-08-31'); // the following Monday
  assert.equal(p.weeks.length, 22);
  assert.deepEqual(p.weeks[0], DEFAULT_PLAN_WEEKS[0]);
  assert.notEqual(p.weeks, DEFAULT_PLAN_WEEKS); // a copy, not the shared const
  assert.deepEqual(p.race, DEFAULT_RACE); // no race guessed at - blank until the user fills it in
  assert.notEqual(p.race, DEFAULT_RACE); // a copy, not the shared const
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

test('daysUntilRace counts whole days from today to the race date', () => {
  const now = new Date('2026-08-27T15:30:00'); // mid-afternoon, shouldn't matter
  assert.equal(daysUntilRace({ date: '2026-08-27' }, now), 0); // race day itself
  assert.equal(daysUntilRace({ date: '2026-09-06' }, now), 10); // in the future
  assert.equal(daysUntilRace({ date: '2026-08-17' }, now), -10); // in the past
});

test('daysUntilRace is null when no race date is set', () => {
  assert.equal(daysUntilRace(null), null);
  assert.equal(daysUntilRace({ date: '' }), null);
  assert.equal(daysUntilRace(DEFAULT_RACE), null);
});

test('weeksNeededForRace spans from week 1\'s Monday through the race week', () => {
  assert.equal(weeksNeededForRace('2026-08-31', '2026-08-31'), 1); // race in week 1 itself
  assert.equal(weeksNeededForRace('2026-08-31', '2026-09-06'), 1); // still week 1 (Sunday)
  assert.equal(weeksNeededForRace('2026-08-31', '2026-09-07'), 2); // week 2's Monday
  assert.equal(weeksNeededForRace('2026-08-31', '2026-09-13'), 2); // week 2's Sunday
  assert.equal(weeksNeededForRace('2026-08-31', '2026-09-14'), 3); // week 3
});

test('weeksNeededForRace floors at 1 when the race is before/at week 1 start', () => {
  assert.equal(weeksNeededForRace('2026-08-31', '2026-08-24'), 1); // a week before start
});

test('weeksNeededForRace normalizes non-Monday inputs to their own week', () => {
  assert.equal(weeksNeededForRace('2026-09-02', '2026-09-02'), 1); // both mid-week, same week
  assert.equal(weeksNeededForRace('2026-09-02', '2026-09-08'), 2); // race the following Tuesday
});

test('weeksNeededForRace is null when either date is missing', () => {
  assert.equal(weeksNeededForRace('', '2026-09-07'), null);
  assert.equal(weeksNeededForRace('2026-08-31', ''), null);
  assert.equal(weeksNeededForRace(null, null), null);
});

test('resizeWeeks returns the input as-is when already the right length', () => {
  const weeks = [{ totalKm: 10, longRunKm: 3, note: '' }];
  assert.equal(resizeWeeks(weeks, 1), weeks);
});

test('resizeWeeks truncates the tail when shrinking', () => {
  const weeks = [
    { totalKm: 10, longRunKm: 3, note: 'a' },
    { totalKm: 12, longRunKm: 4, note: 'b' },
    { totalKm: 14, longRunKm: 5, note: 'c' },
  ];
  assert.deepEqual(resizeWeeks(weeks, 2), [weeks[0], weeks[1]]);
});

test('resizeWeeks appends copies of the last week (blank note) when growing', () => {
  const weeks = [{ totalKm: 10, longRunKm: 3, note: 'taper' }];
  const result = resizeWeeks(weeks, 3);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], weeks[0]);
  assert.deepEqual(result[1], { totalKm: 10, longRunKm: 3, note: '' });
  assert.deepEqual(result[2], { totalKm: 10, longRunKm: 3, note: '' });
});

test('resizeWeeks growing from empty produces zeroed weeks', () => {
  assert.deepEqual(resizeWeeks([], 2), [
    { totalKm: 0, longRunKm: 0, note: '' },
    { totalKm: 0, longRunKm: 0, note: '' },
  ]);
});

test('defaultSplitsForWeek looks up the phase, stripping a "(cutback)" suffix', () => {
  assert.deepEqual(defaultSplitsForWeek('Base'), { easyPct: 48, tempoPct: 14, intervalsPct: 0 });
  assert.deepEqual(defaultSplitsForWeek('Base (cutback)'), { easyPct: 48, tempoPct: 14, intervalsPct: 0 });
  assert.deepEqual(defaultSplitsForWeek('Build'), { easyPct: 39, tempoPct: 12, intervalsPct: 12 });
  assert.deepEqual(defaultSplitsForWeek('Peak'), { easyPct: 37, tempoPct: 13, intervalsPct: 13 });
  assert.deepEqual(defaultSplitsForWeek('Taper'), { easyPct: 46, tempoPct: 13, intervalsPct: 0 });
});

test('defaultSplitsForWeek falls back to a neutral all-easy split for an unknown phase', () => {
  assert.deepEqual(defaultSplitsForWeek('Race week'), { easyPct: 50, tempoPct: 0, intervalsPct: 0 });
  assert.deepEqual(defaultSplitsForWeek(''), { easyPct: 50, tempoPct: 0, intervalsPct: 0 });
  assert.deepEqual(defaultSplitsForWeek(undefined), { easyPct: 50, tempoPct: 0, intervalsPct: 0 });
});

test('weekSplits prefers a week\'s own saved splits over the phase default', () => {
  const custom = { easyPct: 60, tempoPct: 10, intervalsPct: 5 };
  assert.deepEqual(weekSplits({ note: 'Base', splits: custom }), custom);
});

test('weekSplits falls back to the phase default when a week has no splits saved', () => {
  assert.deepEqual(weekSplits({ note: 'Build' }), { easyPct: 39, tempoPct: 12, intervalsPct: 12 });
  assert.deepEqual(weekSplits(null), { easyPct: 50, tempoPct: 0, intervalsPct: 0 });
});

test('weekSessionKm derives each session type\'s km from total km x its split percentage', () => {
  const week = { totalKm: 30, longRunKm: 12, note: 'Build' };
  const km = weekSessionKm(week);
  assert.equal(km.longRunKm, 12);
  assert.equal(km.longRunPct, 40); // 12/30
  assert.equal(km.easyKm, 11.7); // 30 * 39%
  assert.equal(km.tempoKm, 3.6); // 30 * 12%
  assert.equal(km.intervalsKm, 3.6); // 30 * 12%
});

test('weekSessionKm uses a week\'s own custom splits when present', () => {
  const week = { totalKm: 20, longRunKm: 8, note: 'Base', splits: { easyPct: 30, tempoPct: 20, intervalsPct: 10 } };
  const km = weekSessionKm(week);
  assert.equal(km.easyKm, 6);
  assert.equal(km.tempoKm, 4);
  assert.equal(km.intervalsKm, 2);
});

test('weekSessionKm handles a zero-total week without dividing by zero', () => {
  const km = weekSessionKm({ totalKm: 0, longRunKm: 0, note: 'Base' });
  assert.equal(km.longRunPct, 0);
  assert.equal(km.easyKm, 0);
});
