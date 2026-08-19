import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentWeek, retestWeeks, totalPlannedSessions, sessionChecklist,
  daysSinceLastSession, averageIntervalHR, vo2maxSeries,
} from '../vo2max/js/block.js';

const settings = {
  baselineDate: '2026-08-01',
  baselineVO2max: 46,
  protocolStartDate: '2026-08-03',
  protocol: { reps: 4, freqPerWeek: 2, blockWeeks: 8 },
};

test('currentWeek advances every 7 days and clamps to the block length', () => {
  assert.equal(currentWeek(settings, '2026-08-03'), 1);
  assert.equal(currentWeek(settings, '2026-08-09'), 1);
  assert.equal(currentWeek(settings, '2026-08-10'), 2);
  assert.equal(currentWeek(settings, '2027-01-01'), 8); // clamped
});

test('retestWeeks is the block midpoint and end', () => {
  assert.deepEqual(retestWeeks(settings), [4, 8]);
  assert.deepEqual(retestWeeks({ protocol: { blockWeeks: 6 } }), [3, 6]);
});

test('totalPlannedSessions multiplies frequency by block length', () => {
  assert.equal(totalPlannedSessions(settings), 16);
});

test('sessionChecklist fills slots in date order and tags each with its week', () => {
  const sessions = [
    { id: 'a', date: '2026-08-04' },
    { id: 'b', date: '2026-08-06' },
    { id: 'c', date: '2026-08-11' },
  ];
  const list = sessionChecklist(settings, sessions);
  assert.equal(list.length, 16);
  assert.equal(list[0].done, true);
  assert.equal(list[0].sessionId, 'a');
  assert.equal(list[1].sessionId, 'b');
  assert.equal(list[1].week, 1);
  assert.equal(list[2].sessionId, 'c');
  assert.equal(list[2].week, 2); // 3rd slot, freq=2 -> week 2
  assert.equal(list[3].done, false);
});

test('sessionChecklist skips easy runs — only the interval block counts', () => {
  const sessions = [
    { id: 'a', type: 'interval', date: '2026-08-04' },
    { id: 'run', type: 'easy-run', date: '2026-08-05' },
    { id: 'b', type: 'interval', date: '2026-08-06' },
    { id: 'legacy', date: '2026-08-07' }, // no type field: pre-dates the feature, treated as interval
  ];
  const list = sessionChecklist(settings, sessions);
  assert.equal(list.filter((c) => c.done).length, 3);
  assert.equal(list[0].sessionId, 'a');
  assert.equal(list[1].sessionId, 'b');
  assert.equal(list[2].sessionId, 'legacy');
});

test('daysSinceLastSession looks at the most recent date', () => {
  const sessions = [{ date: '2026-08-01' }, { date: '2026-08-10' }];
  assert.equal(daysSinceLastSession(sessions, '2026-08-15'), 5);
  assert.equal(daysSinceLastSession([]), null);
});

test('averageIntervalHR pools avgHR across all sessions', () => {
  const sessions = [
    { intervals: [{ avgHR: 180 }, { avgHR: 182 }] },
    { intervals: [{ avgHR: 176 }] },
  ];
  assert.equal(averageIntervalHR(sessions), Math.round((180 + 182 + 176) / 3));
  assert.equal(averageIntervalHR([]), null);
});

test('vo2maxSeries starts with baseline and includes only sessions with a reading', () => {
  const sessions = [
    { date: '2026-08-20', vo2max: 47 },
    { date: '2026-08-10', vo2max: null },
  ];
  const series = vo2maxSeries(settings, sessions);
  assert.deepEqual(series.map((p) => p.date), ['2026-08-01', '2026-08-20']);
  assert.equal(series[0].label, 'Baseline');
});
