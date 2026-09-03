import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivityStreams, classifyActivity, activityToSession } from '../hybrd-app/js/intervals.js';

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

test('classifyActivity buckets Run/TrailRun/VirtualRun as sport run with the existing easy-run type', () => {
  for (const type of ['Run', 'TrailRun', 'VirtualRun']) {
    assert.deepEqual(classifyActivity({ type }), { sport: 'run', type: 'easy-run' });
  }
});

test('classifyActivity buckets ride types as sport ride with a display label', () => {
  assert.deepEqual(classifyActivity({ type: 'Ride' }), { sport: 'ride', type: 'Ride' });
  assert.deepEqual(classifyActivity({ type: 'GravelRide' }), { sport: 'ride', type: 'Gravel ride' });
});

test('classifyActivity buckets swim types as sport swim with a display label', () => {
  assert.deepEqual(classifyActivity({ type: 'Swim' }), { sport: 'swim', type: 'Swim' });
  assert.deepEqual(classifyActivity({ type: 'OpenWaterSwim' }), { sport: 'swim', type: 'Open water swim' });
});

test('classifyActivity falls back an unknown type to sport other, using the raw type as the label', () => {
  assert.deepEqual(classifyActivity({ type: 'SomeFutureActivityType' }), { sport: 'other', type: 'SomeFutureActivityType' });
});

test('classifyActivity maps a known non-run/ride/swim type (e.g. WeightTraining) to sport other with its label', () => {
  assert.deepEqual(classifyActivity({ type: 'WeightTraining' }), { sport: 'other', type: 'Weight training' });
});

test('activityToSession computes avgPace (min/km) for a run, leaving speed/pace100m unset', () => {
  const session = activityToSession({
    id: 'a1', type: 'Run', name: 'Morning run',
    start_date_local: '2026-05-01T07:00:00', distance: 10000, moving_time: 3000,
    average_heartrate: 150, max_heartrate: 170,
  });
  assert.equal(session.sport, 'run');
  assert.equal(session.type, 'easy-run');
  assert.equal(session.distanceKm, 10);
  assert.equal(session.durationMin, 50);
  assert.equal(session.avgPace, 5); // 50min / 10km
  assert.equal(session.avgSpeedKmh, undefined);
  assert.equal(session.avgPace100m, undefined);
});

test('activityToSession computes avgSpeedKmh for a ride, leaving pace/pace100m unset', () => {
  const session = activityToSession({
    id: 'a2', type: 'Ride', name: 'Evening ride',
    start_date_local: '2026-05-02T18:00:00', distance: 30000, moving_time: 3600,
  });
  assert.equal(session.sport, 'ride');
  assert.equal(session.type, 'Ride');
  assert.equal(session.distanceKm, 30);
  assert.equal(session.durationMin, 60);
  assert.equal(session.avgSpeedKmh, 30); // 30km in 60min = 30km/h
  assert.equal(session.avgPace, undefined);
  assert.equal(session.avgPace100m, undefined);
});

test('activityToSession computes avgPace100m for a swim, leaving pace/speed unset', () => {
  const session = activityToSession({
    id: 'a3', type: 'Swim', name: 'Pool swim',
    start_date_local: '2026-05-03T06:00:00', distance: 2000, moving_time: 2400,
  });
  assert.equal(session.sport, 'swim');
  assert.equal(session.type, 'Swim');
  assert.equal(session.distanceKm, 2);
  // 40min for 2000m = 20 hundred-metre units -> 2min/100m
  assert.equal(session.avgPace100m, 2);
  assert.equal(session.avgPace, undefined);
  assert.equal(session.avgSpeedKmh, undefined);
});

test('activityToSession leaves all pace-like fields unset for an "other" sport activity', () => {
  const session = activityToSession({
    id: 'a4', type: 'WeightTraining', name: 'Gym session',
    start_date_local: '2026-05-04T09:00:00', distance: null, moving_time: 2700,
    average_heartrate: 110,
  });
  assert.equal(session.sport, 'other');
  assert.equal(session.type, 'Weight training');
  assert.equal(session.distanceKm, null);
  assert.equal(session.durationMin, 45);
  assert.equal(session.avgPace, undefined);
  assert.equal(session.avgSpeedKmh, undefined);
  assert.equal(session.avgPace100m, undefined);
});

test('activityToSession sets intervalsActivityId and a notes line for every sport', () => {
  const session = activityToSession({
    id: 'a5', type: 'Hike', name: 'Ridge trail',
    start_date_local: '2026-05-05T10:00:00', distance: 8000, moving_time: 120,
  });
  assert.equal(session.intervalsActivityId, 'a5');
  assert.equal(session.notes, 'Imported from intervals.icu: "Ridge trail"');
  assert.equal(session.sport, 'other');
  assert.equal(session.type, 'Hike');
});
