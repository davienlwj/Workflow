import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkoutText, summarizeForNotes } from '../vo2max/js/photoParse.js';

// A hand-transcribed approximation of what OCR reads off the Zepp/Amazfit
// "activity detail" screenshot: numbers sit above their labels in the
// source image, so reading order is value-then-label throughout, exactly
// as it would come out of an OCR pass on this card.
const SAMPLE_OCR_TEXT = `
davienlwj
Treadmill
Z E P P
18 Aug at 19:21
Amazfit T-Rex 3 Pro (44mm)
4.17
km
25:04
Workout time
06'00"
Avg pace
158
Avg heart rate
310
Calories
05'36"
Best pace
58
Training load
Detailed data >
PACE
(min/km)
06'00"
Avg
05'36"
Optimum
5'00" 6'00" 7'00" 8'00" 9'00"
00:16 12:32 18:48 25:04
HEART RATE
(bpm)
158
Avg
176
Max
180 158 135 112
00:00 06:16 12:32 18:48 25:04
HEART RATE ZONE
Anaerobic endurance
179-197 bpm
0%
00:00
Lactate threshold
168-178 bpm
25%
06:28
Aerobic endurance
159-167 bpm
18%
04:33
Efficient Fat Burning
146-158 bpm
41%
10:23
Active Recovery
117-145 bpm
14%
03:37
`;

test('parseWorkoutText extracts the headline fields from a Zepp workout card', () => {
  const now = new Date('2026-08-19T00:00:00');
  const parsed = parseWorkoutText(SAMPLE_OCR_TEXT, { now });
  assert.equal(parsed.date, '2026-08-18');
  assert.equal(parsed.durationMin, 25.1); // 25:04 -> 25 + 4/60
  assert.equal(parsed.distanceKm, 4.17);
  assert.equal(parsed.avgHR, 158);
  assert.equal(parsed.maxHR, 176);
  assert.equal(parsed.calories, 310);
  assert.equal(parsed.trainingLoad, 58);
});

test('parseWorkoutText reads avg and best pace as min\'sec/km', () => {
  const parsed = parseWorkoutText(SAMPLE_OCR_TEXT);
  assert.equal(parsed.avgPace, "06'00\"/km");
  assert.equal(parsed.bestPace, "05'36\"/km");
});

test('parseWorkoutText reads all five HR zones with percent and time', () => {
  const parsed = parseWorkoutText(SAMPLE_OCR_TEXT);
  assert.equal(parsed.zones.length, 5);
  const efb = parsed.zones.find((z) => z.name === 'Efficient Fat Burning');
  assert.equal(efb.pct, 41);
  assert.equal(efb.time, '10:23');
  const anaerobic = parsed.zones.find((z) => z.name === 'Anaerobic endurance');
  assert.equal(anaerobic.pct, 0);
  assert.equal(anaerobic.time, '00:00');
});

test('parseDate rolls back a year when a dateless-year reading would land in the future', () => {
  // "18 Aug" parsed on 5 Jan the following year should resolve to last August, not next.
  const now = new Date('2027-01-05T00:00:00');
  const parsed = parseWorkoutText(SAMPLE_OCR_TEXT, { now });
  assert.equal(parsed.date, '2026-08-18');
});

test('parseWorkoutText degrades gracefully on unrelated or empty text', () => {
  const parsed = parseWorkoutText('just some random unrelated text with no workout data');
  assert.equal(parsed.date, null);
  assert.equal(parsed.durationMin, null);
  assert.equal(parsed.distanceKm, null);
  assert.equal(parsed.avgHR, null);
  assert.deepEqual(parsed.zones, []);
});

test('summarizeForNotes folds pace, calories, training load and zones into one block', () => {
  const parsed = parseWorkoutText(SAMPLE_OCR_TEXT, { now: new Date('2026-08-19T00:00:00') });
  const notes = summarizeForNotes(parsed);
  assert.match(notes, /Pace: avg 06'00"\/km, best 05'36"\/km/);
  assert.match(notes, /Calories: 310/);
  assert.match(notes, /Training load: 58/);
  assert.match(notes, /HR zones:.*Efficient Fat Burning 41% \(10:23\)/);
});

test('summarizeForNotes returns an empty string when nothing extra was found', () => {
  assert.equal(summarizeForNotes(parseWorkoutText('nothing here')), '');
});

test('parseWorkoutText still finds values when OCR reads label before value instead of after', () => {
  // Real OCR order for a card layout isn't guaranteed; stat tiles should
  // resolve correctly either way (unlike the zone list, which relies on a
  // fixed forward order because entries repeat).
  const reversed = `
Calories 310

Training load 58

Workout time 25:04
`;
  const parsed = parseWorkoutText(reversed);
  assert.equal(parsed.calories, 310);
  assert.equal(parsed.trainingLoad, 58);
  assert.equal(parsed.durationMin, 25.1);
});
