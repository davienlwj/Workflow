import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTask, formatTime, formatDate } from '../js/parser.js';

// A fixed "now" so every expectation is stable: Wed 12 Aug 2026, 10:00.
const NOW = new Date(2026, 7, 12, 10, 0, 0);
const p = (s, opts = {}) => parseTask(s, { now: NOW, ...opts });

test('the headline example', () => {
  const r = p('meeting with Tom at KLCC at 3pm on 12/8');
  assert.equal(r.title, 'Meeting with Tom');
  assert.equal(r.location, 'KLCC');
  assert.equal(r.time, '15:00');
  assert.equal(r.date, '2026-08-12');
  assert.deepEqual(r.people, ['Tom']);
});

test('times', () => {
  assert.equal(p('call 9am').time, '09:00');
  assert.equal(p('call 9.30am').time, '09:30');
  assert.equal(p('call at 10:15').time, '10:15');
  assert.equal(p('standup 14:00').time, '14:00');
  assert.equal(p('gym at 3').time, '15:00');          // 1-7 reads as afternoon
  assert.equal(p('gym at 9').time, '09:00');          // 8-11 reads as morning
  assert.equal(p('dinner at 8').time, '20:00');       // meal settles am vs pm
  assert.equal(p('lunch at 1').time, '13:00');
  assert.equal(p('breakfast at 8').time, '08:00');
  // A meal on its own is not a time.
  assert.equal(p('lunch with Tom tomorrow').time, null);
  assert.equal(p('lunch at noon').time, '12:00');
  assert.equal(p('deploy at midnight').time, '00:00');
  assert.equal(p('call at 9 in the evening').time, '21:00');
});

test('time ranges and durations', () => {
  const a = p('workshop 3-5pm');
  assert.equal(a.time, '15:00');
  assert.equal(a.endTime, '17:00');

  const b = p('review from 9:30 to 11am');
  assert.equal(b.time, '09:30');
  assert.equal(b.endTime, '11:00');

  const c = p('deep work 2pm for 2 hours');
  assert.equal(c.time, '14:00');
  assert.equal(c.endTime, '16:00');

  const d = p('call 3pm for 45 mins');
  assert.equal(d.endTime, '15:45');
});

test('dates - relative', () => {
  assert.equal(p('pay bills today').date, '2026-08-12');
  assert.equal(p('pay bills tomorrow').date, '2026-08-13');
  assert.equal(p('pay bills tmr').date, '2026-08-13');
  assert.equal(p('dinner tonight').date, '2026-08-12');
  assert.equal(p('review in 3 days').date, '2026-08-15');
  assert.equal(p('holiday in 2 weeks').date, '2026-08-26');
  assert.equal(p('checkup next week').date, '2026-08-19');
});

test('dates - weekdays', () => {
  assert.equal(p('gym on friday').date, '2026-08-14');   // Wed -> Fri
  assert.equal(p('gym on monday').date, '2026-08-17');   // wraps to next week
  assert.equal(p('call next wednesday').date, '2026-08-19'); // "next" on a Wed
  assert.equal(p('call this wednesday').date, '2026-08-12');
});

test('dates - numeric and written', () => {
  assert.equal(p('flight on 25/12').date, '2026-12-25');
  assert.equal(p('flight on 25-12-2027').date, '2027-12-25');
  assert.equal(p('flight on 1/9/26').date, '2026-09-01');
  assert.equal(p('flight 12 Aug').date, '2026-08-12');
  assert.equal(p('flight Aug 25').date, '2026-08-25');
  assert.equal(p('flight 3rd of September').date, '2026-09-03');
  assert.equal(p('flight 2026-11-05').date, '2026-11-05');
});

test('day-first vs month-first reading', () => {
  assert.equal(p('meeting 12/8').date, '2026-08-12');
  assert.equal(p('meeting 12/8', { dayFirst: false }).date, '2026-12-08');
  // Impossible as a month, so it flips regardless of the setting.
  assert.equal(p('meeting 25/3', { dayFirst: false }).date, '2027-03-25');
});

test('a bare date well in the past rolls to next year', () => {
  assert.equal(p('renew passport 5/1').date, '2027-01-05');
  // ...but an explicit year is respected.
  assert.equal(p('renew passport 5/1/2026').date, '2026-01-05');
  // ...and a date that just passed is taken at face value.
  assert.equal(p('paid deposit 10/8').date, '2026-08-10');
  assert.equal(p('lodged claim 8 Aug').date, '2026-08-08');
});

test('locations', () => {
  assert.equal(p('lunch at Suria KLCC 1pm').location, 'Suria KLCC');
  assert.equal(p('meet at Starbucks Bangsar tomorrow').location, 'Starbucks Bangsar');
  assert.equal(p('standup in the office at 9am').location, 'the office');
  assert.equal(p('coffee @ Ilham Tower').location, 'Ilham Tower');
  // Stops at a connector rather than swallowing the rest of the sentence.
  assert.equal(p('meet at KLCC to discuss the budget').location, 'KLCC');
  // "at 3pm" is a time, never a place.
  assert.equal(p('call Tom at 3pm').location, null);
  assert.equal(p('submit report').location, null);
});

test('subject is what is left over', () => {
  assert.equal(p('dentist appointment at Gleneagles 2pm on friday').title, 'Dentist appointment');
  assert.equal(p('submit tax filing before 30/4').title, 'Submit tax filing before');
  assert.equal(p('call mum tonight').title, 'Call mum');
  assert.equal(p('3pm').title, 'Untitled');
});

test('empty and junk input never throws', () => {
  for (const s of ['', '   ', null, undefined, '???', '12/8', 'at at at']) {
    const r = parseTask(s, { now: NOW });
    assert.equal(typeof r.title, 'string');
    assert.ok(r.title.length > 0);
  }
});

test('formatters', () => {
  assert.equal(formatTime('15:00'), '3pm');
  assert.equal(formatTime('09:30'), '9:30am');
  assert.equal(formatTime('00:00'), '12am');
  assert.equal(formatTime('15:30', true), '15:30');
  assert.equal(formatDate('2026-08-12', NOW), 'Today');
  assert.equal(formatDate('2026-08-13', NOW), 'Tomorrow');
  assert.equal(formatDate(null, NOW), 'No date');
});
