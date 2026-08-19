import test from 'node:test';
import assert from 'node:assert/strict';
import { lthrZoneTable, rhrZoneTable, targetZone } from '../vo2max/js/zones.js';

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
