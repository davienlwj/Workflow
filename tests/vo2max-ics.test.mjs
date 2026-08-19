import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionToICS } from '../vo2max/js/ics.js';

const baseSession = {
  id: 'abc123',
  type: 'interval',
  date: '2026-08-18',
  intervalsCompleted: 4,
  intervals: [
    { avgHR: 182, peakHR: 190, durationMin: 4 },
    { avgHR: 183, peakHR: 191, durationMin: 4.1 },
    { avgHR: 184, peakHR: 192, durationMin: 4 },
    { avgHR: 185, peakHR: 193, durationMin: 3.9 },
  ],
  recovery: 'moderate',
  rpe: 6,
  vo2max: 47.2,
  notes: 'Felt strong, cool weather',
};

const easyRunSession = {
  id: 'run456',
  type: 'easy-run',
  date: '2026-08-17',
  durationMin: 45,
  avgPace: 5.5,
  distanceKm: 8.2,
  avgHR: 148,
  rpe: 4,
  vo2max: null,
  notes: 'Easy shakeout',
};

test('sessionToICS produces a well-formed VEVENT with correct dates', () => {
  const ics = sessionToICS(baseSession);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /UID:abc123@vo2max-tracker/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260818/);
  // All-day events use an exclusive DTEND: the day after.
  assert.match(ics, /DTEND;VALUE=DATE:20260819/);
  assert.match(ics, /SUMMARY:VO2max: 4 intervals \(Moderate\)/);
});

test('sessionToICS escapes commas, semicolons and newlines in notes', () => {
  const session = { ...baseSession, notes: 'Rain, wind; tough day\nfelt slow' };
  const unfolded = sessionToICS(session).replaceAll('\r\n ', '');
  assert.match(unfolded, /Notes: Rain\\, wind\\; tough day\\nfelt slow/);
});

test('sessionToICS folds long lines at 75 octets with a leading space continuation', () => {
  const session = { ...baseSession, notes: 'x'.repeat(200) };
  const ics = sessionToICS(session);
  const lines = ics.split('\r\n');
  for (const line of lines) {
    // A folded continuation line starts with a space; that line itself
    // must still respect the 75-octet cap (the leading space counts).
    assert.ok(line.length <= 75, `line too long: ${line.length} chars`);
  }
  assert.ok(lines.some((l) => l.startsWith(' ')), 'expected at least one folded continuation line');
});

test('sessionToICS omits the VO2max line when no reading was logged', () => {
  const session = { ...baseSession, vo2max: null };
  const ics = sessionToICS(session);
  assert.doesNotMatch(ics, /VO2max reading/);
});

test('sessionToICS includes each interval\'s logged duration', () => {
  const unfolded = sessionToICS(baseSession).replaceAll('\r\n ', '');
  assert.match(unfolded, /S1 182\/190 \(4min\)/);
  assert.match(unfolded, /S2 183\/191 \(4\.1min\)/);
});

test('sessionToICS builds an easy-run summary and description', () => {
  const unfolded = sessionToICS(easyRunSession).replaceAll('\r\n ', '');
  assert.match(unfolded, /SUMMARY:Easy run: 45min\\, 8\.2km/);
  assert.match(unfolded, /Duration: 45 min/);
  assert.match(unfolded, /Avg pace: 5\.5 min\/km/);
  assert.match(unfolded, /Distance: 8\.2 km/);
  assert.match(unfolded, /Average HR: 148 bpm/);
  assert.doesNotMatch(unfolded, /Intervals completed/);
  assert.doesNotMatch(unfolded, /VO2max reading/);
});

test('sessionToICS builds a long-run summary distinct from an easy run', () => {
  const longRun = { ...easyRunSession, type: 'long-run', durationMin: 110, distanceKm: 18 };
  const unfolded = sessionToICS(longRun).replaceAll('\r\n ', '');
  assert.match(unfolded, /SUMMARY:Long run: 110min\\, 18km/);
});

test('sessionToICS treats a session with no type field as interval (pre-dates the type field)', () => {
  const legacy = { ...baseSession };
  delete legacy.type;
  const unfolded = sessionToICS(legacy).replaceAll('\r\n ', '');
  assert.match(unfolded, /SUMMARY:VO2max: 4 intervals \(Moderate\)/);
  assert.match(unfolded, /Intervals completed: 4/);
});
