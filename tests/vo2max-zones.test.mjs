import test from 'node:test';
import assert from 'node:assert/strict';
import { lthrZoneTable, rhrZoneTable, targetZone, hrZoneDurations } from '../vo2max/js/zones.js';

const settings = {
  restingHR: 54,
  maxHR: 194,
  lthr: 181,
  primaryZoneModel: 'lthr',
};

test('LTHR zone table matches the known bpm bands', () => {
  const table = lthrZoneTable(settings);
  assert.deepEqual(table.map((z) => [z.bpmLow, z.bpmHigh]), [
    [117, 145],
    [146, 158],
    [159, 167],
    [168, 178],
    [179, 197],
  ]);
});

test('RHR (Karvonen) zone table matches the known bpm bands', () => {
  const table = rhrZoneTable(settings);
  assert.deepEqual(table.map((z) => [z.bpmLow, z.bpmHigh]), [
    [124, 138],
    [139, 152],
    [153, 166],
    [167, 180],
    [181, 194],
  ]);
});

test('targetZone follows primaryZoneModel', () => {
  assert.equal(targetZone(settings).name, 'Anaerobic endurance');
  assert.equal(targetZone({ ...settings, primaryZoneModel: 'rhr' }).name, 'Zone 5');
});

test('zone bpm bands move when HR inputs change', () => {
  const table = lthrZoneTable({ ...settings, lthr: 190 });
  assert.equal(table[0].bpmLow, Math.floor(190 * 0.65));
});

test('hrZoneDurations attributes elapsed seconds to the zone of the later sample', () => {
  const table = rhrZoneTable(settings); // Z1 124-138, Z2 139-152, ... Z5 181-194
  const points = [
    { t: 0, hr: 130 },   // Z1 - first point, no "since" yet, contributes nothing
    { t: 10, hr: 130 },  // Z1 for 10s (0->10)
    { t: 20, hr: 145 },  // Z2 for 10s (10->20)
    { t: 30, hr: 145 },  // Z2 for 10s (20->30)
    { t: 40, hr: 185 },  // Z5 for 10s (30->40)
  ];
  const result = hrZoneDurations(points, table);
  const secsByName = Object.fromEntries(result.map((z) => [z.name, z.secs]));
  assert.equal(secsByName['Zone 1'], 10);
  assert.equal(secsByName['Zone 2'], 20);
  assert.equal(secsByName['Zone 3'], 0);
  assert.equal(secsByName['Zone 4'], 0);
  assert.equal(secsByName['Zone 5'], 10);
});

test('hrZoneDurations excludes gaps longer than 30s (paused/dropped recording)', () => {
  const table = rhrZoneTable(settings);
  const points = [
    { t: 0, hr: 130 },
    { t: 500, hr: 130 }, // huge gap - not attributed to Zone 1
    { t: 510, hr: 130 }, // normal 10s gap - attributed
  ];
  const result = hrZoneDurations(points, table);
  const zone1 = result.find((z) => z.name === 'Zone 1');
  assert.equal(zone1.secs, 10);
});

test('hrZoneDurations skips the interval ending in a null HR reading', () => {
  const table = rhrZoneTable(settings);
  const points = [
    { t: 0, hr: 130 },
    { t: 10, hr: null }, // 0->10 unclassifiable, excluded
    { t: 20, hr: 130 },  // 10->20 classifies into Zone 1
  ];
  const result = hrZoneDurations(points, table);
  const totalSecs = result.reduce((sum, z) => sum + z.secs, 0);
  assert.equal(totalSecs, 10);
});
