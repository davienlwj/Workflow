import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeFor, summarize, groupByDate, summaryText, emptyText } from '../js/ranges.js';

// Wed 12 Aug 2026.
const NOW = new Date(2026, 7, 12, 10, 0, 0);

test('day range is the single day', () => {
  const r = rangeFor('day', '2026-08-12', 1, NOW);
  assert.equal(r.start, '2026-08-12');
  assert.equal(r.end, '2026-08-12');
  assert.match(r.label, /^Today · /);
  assert.match(rangeFor('day', '2026-08-13', 1, NOW).label, /^Tomorrow · /);
  assert.match(rangeFor('day', '2026-08-11', 1, NOW).label, /^Yesterday · /);
  assert.doesNotMatch(rangeFor('day', '2026-08-20', 1, NOW).label, /Today|Tomorrow|Yesterday/);
});

test('week range follows the week-start setting', () => {
  const mon = rangeFor('week', '2026-08-12', 1, NOW);
  assert.equal(mon.start, '2026-08-10'); // Monday
  assert.equal(mon.end, '2026-08-16');   // Sunday

  const sun = rangeFor('week', '2026-08-12', 0, NOW);
  assert.equal(sun.start, '2026-08-09');
  assert.equal(sun.end, '2026-08-15');
});

test('week range works on its own boundaries', () => {
  assert.equal(rangeFor('week', '2026-08-10', 1, NOW).start, '2026-08-10');
  assert.equal(rangeFor('week', '2026-08-16', 1, NOW).start, '2026-08-10');
  // A week spanning two months keeps both ends.
  const across = rangeFor('week', '2026-09-01', 1, NOW);
  assert.equal(across.start, '2026-08-31');
  assert.equal(across.end, '2026-09-06');
  // Both ends named, whatever order the locale puts them in.
  assert.match(across.label, /31/);
  assert.match(across.label, /\b6\b/);

  // A week straddling new year carries both years.
  const newYear = rangeFor('week', '2026-12-31', 1, NOW);
  assert.equal(newYear.start, '2026-12-28');
  assert.equal(newYear.end, '2027-01-03');
  assert.match(newYear.label, /2026/);
  assert.match(newYear.label, /2027/);
});

test('month range covers the whole month, including February', () => {
  const aug = rangeFor('month', '2026-08-20', 1, NOW);
  assert.equal(aug.start, '2026-08-01');
  assert.equal(aug.end, '2026-08-31');
  assert.match(aug.label, /2026/);

  assert.equal(rangeFor('month', '2026-02-10', 1, NOW).end, '2026-02-28');
  assert.equal(rangeFor('month', '2028-02-10', 1, NOW).end, '2028-02-29'); // leap year
});

test('year range covers the whole year', () => {
  const r = rangeFor('year', '2026-08-12', 1, NOW);
  assert.equal(r.start, '2026-01-01');
  assert.equal(r.end, '2026-12-31');
  assert.equal(r.label, '2026');
});

test('ISO bounds compare correctly as strings', () => {
  // The store filters with plain string comparison, so the bounds must sort.
  const { start, end } = rangeFor('month', '2026-08-12', 1, NOW);
  assert.ok(start <= '2026-08-01' && '2026-08-31' <= end);
  assert.ok(!('2026-07-31' >= start));
  assert.ok(!('2026-09-01' <= end));
});

test('summaries count done and remaining', () => {
  const tasks = [{ done: true }, { done: false }, { done: false }];
  assert.deepEqual(summarize(tasks), { total: 3, done: 1, left: 2 });
  assert.equal(summaryText(tasks), '3 tasks · 1 done');
  assert.equal(summaryText([{ done: false }]), '1 task');
  assert.equal(summaryText([]), '');
  // Holidays are counted alongside, never folded into the task total.
  assert.equal(summaryText(tasks, 2), '3 tasks · 1 done · 2 holidays');
  assert.equal(summaryText([], 1), '1 holiday');
  assert.equal(summaryText([{ done: false }], 1), '1 task · 1 holiday');
});

test('grouping keeps days in order', () => {
  const groups = groupByDate([
    { date: '2026-08-14', title: 'c' },
    { date: '2026-08-12', title: 'a' },
    { date: '2026-08-14', title: 'd' },
    { date: '2026-08-13', title: 'b' },
  ]);
  assert.deepEqual(groups.map(([iso, list]) => [iso, list.length]), [
    ['2026-08-12', 1], ['2026-08-13', 1], ['2026-08-14', 2],
  ]);
});

test('empty wording matches the scope', () => {
  assert.equal(emptyText('week'), 'Nothing this week.');
  assert.equal(emptyText('year'), 'Nothing this year.');
});
