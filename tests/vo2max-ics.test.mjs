import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionToICS } from '../vo2max/js/ics.js';

const baseSession = {
  id: 'abc123',
  date: '2026-08-18',
  intervalsCompleted: 4,
  intervals: [
    { avgHR: 182, peakHR: 190 },
    { avgHR: 183, peakHR: 191 },
    { avgHR: 184, peakHR: 192 },
    { avgHR: 185, peakHR: 193 },
  ],
  recovery: 'moderate',
  rpe: 6,
  vo2max: 47.2,
  notes: 'Felt strong, cool weather',
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
