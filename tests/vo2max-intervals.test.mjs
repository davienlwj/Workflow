import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivityStreams } from '../vo2max/js/intervals.js';

function stubFetch(streams) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => streams,
  });
}

test('fetchActivityStreams pairs time/heartrate/velocity_smooth by index and converts pace', async () => {
  stubFetch([
    { type: 'time', data: [0, 10, 20] },
    { type: 'heartrate', data: [120, 140, 160] },
    { type: 'velocity_smooth', data: [0, 3, 4] }, // m/s
  ]);
  const points = await fetchActivityStreams('123', 'key');
  assert.deepEqual(points.map((p) => p.t), [0, 10, 20]);
  assert.deepEqual(points.map((p) => p.hr), [120, 140, 160]);
  assert.equal(points[0].paceMinKm, null); // velocity 0 -> no pace
  assert.equal(points[1].paceMinKm, Math.round((1000 / (3 * 60)) * 100) / 100);
  assert.equal(points[2].paceMinKm, Math.round((1000 / (4 * 60)) * 100) / 100);
});

test('fetchActivityStreams falls back to distance deltas when velocity_smooth is absent', async () => {
  stubFetch([
    { type: 'time', data: [0, 10, 20] },
    { type: 'heartrate', data: [120, 130, 140] },
    { type: 'distance', data: [0, 50, 150] }, // metres, cumulative
  ]);
  const points = await fetchActivityStreams('123', 'key');
  assert.equal(points[0].paceMinKm, null); // first sample has no "since"
  // 10s to cover 50m: (10/60) min / (50/1000) km = 3.333 min/km
  assert.equal(points[1].paceMinKm, Math.round((10 / 60 / (50 / 1000)) * 100) / 100);
  // 10s to cover 100m: (10/60) min / (100/1000) km = 1.667 min/km
  assert.equal(points[2].paceMinKm, Math.round((10 / 60 / (100 / 1000)) * 100) / 100);
});

test('fetchActivityStreams returns an empty array when the activity has no time stream', async () => {
  stubFetch([{ type: 'heartrate', data: [120, 130] }]);
  const points = await fetchActivityStreams('123', 'key');
  assert.deepEqual(points, []);
});

test('fetchActivityStreams tolerates a missing heartrate stream (null hr per point)', async () => {
  stubFetch([
    { type: 'time', data: [0, 10] },
    { type: 'velocity_smooth', data: [0, 3] },
  ]);
  const points = await fetchActivityStreams('123', 'key');
  assert.deepEqual(points.map((p) => p.hr), [null, null]);
});
