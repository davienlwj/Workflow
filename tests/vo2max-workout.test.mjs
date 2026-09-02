import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workoutVolume, lastPerformance, personalRecords, newPRsInWorkout, exerciseProgress, exerciseVolumeProgress, loggedBrandsForExercise,
  loggedExerciseIds, daysSinceLastWorkout, volumeSince, muscleSetBreakdown,
  muscleSetBreakdownDetailed, workoutSummaryByExercise,
} from '../vo2max/js/workout.js';
import { RADAR_GROUPS, MUSCLES, RADAR_GROUP_FOR } from '../vo2max/js/exercises.js';

function makeWorkout(date, exercises) {
  return { id: date, date, exercises };
}

test('workoutVolume sums weight x reps across every set and exercise', () => {
  const w = makeWorkout('2026-08-10', [
    { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }] },
    { exerciseId: 'squat', sets: [{ weight: 80, reps: 5 }] },
  ]);
  assert.equal(workoutVolume(w), 60 * 8 + 60 * 8 + 80 * 5);
});

test('workoutVolume ignores sets missing weight or reps', () => {
  const w = makeWorkout('2026-08-10', [
    { exerciseId: 'bench-press', sets: [{ weight: null, reps: 8 }, { weight: 60, reps: null }] },
  ]);
  assert.equal(workoutVolume(w), 0);
});

test('workoutVolume excludes warm-up sets but counts drop/failure sets', () => {
  const w = makeWorkout('2026-08-10', [
    { exerciseId: 'bench-press', sets: [
      { weight: 20, reps: 10, type: 'warmup' },
      { weight: 60, reps: 8, type: 'normal' },
      { weight: 40, reps: 12, type: 'drop' },
      { weight: 60, reps: 6, type: 'failure' },
    ] },
  ]);
  assert.equal(workoutVolume(w), 60 * 8 + 40 * 12 + 60 * 6);
});

test('workoutVolume treats a set with no type as a normal working set (old data)', () => {
  const w = makeWorkout('2026-08-10', [
    { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] },
  ]);
  assert.equal(workoutVolume(w), 60 * 8);
});

test('workoutVolume adds the user\'s bodyweight for Bodyweight-equipment exercises', () => {
  const w = makeWorkout('2026-08-10', [
    { exerciseId: 'dip', sets: [{ reps: 10 }, { weight: 10, reps: 8 }] }, // bodyweight-only, then +10kg weighted
  ]);
  // 80kg bodyweight: set 1 = 80*10, set 2 = (80+10)*8
  assert.equal(workoutVolume(w, undefined, 80), 80 * 10 + 90 * 8);
});

test('workoutVolume ignores bodyweight when the user has not set one yet', () => {
  const w = makeWorkout('2026-08-10', [{ exerciseId: 'dip', sets: [{ reps: 10 }] }]);
  assert.equal(workoutVolume(w, undefined, null), 0);
});

test('workoutVolume leaves non-bodyweight exercises unaffected by a set bodyweight', () => {
  const w = makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]);
  assert.equal(workoutVolume(w, undefined, 80), 60 * 8);
});

test('lastPerformance returns the most recent workout containing the exercise', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 55, reps: 8 }] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }] }]),
    makeWorkout('2026-08-05', [{ exerciseId: 'squat', sets: [{ weight: 80, reps: 5 }] }]),
  ];
  const last = lastPerformance(workouts, 'bench-press');
  assert.equal(last.date, '2026-08-10');
  assert.deepEqual(last.sets, [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }]);
});

test('lastPerformance returns null when the exercise has never been logged', () => {
  assert.equal(lastPerformance([], 'bench-press'), null);
});

test('lastPerformance returns the machine brand logged with the most recent session', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'leg-press', brand: 'Precor', sets: [{ weight: 100, reps: 10 }] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'leg-press', brand: 'Life Fitness', sets: [{ weight: 110, reps: 8 }] }]),
  ];
  assert.equal(lastPerformance(workouts, 'leg-press').brand, 'Life Fitness');
});

test('lastPerformance returns brand: null when no brand was logged', () => {
  const workouts = [makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }])];
  assert.equal(lastPerformance(workouts, 'bench-press').brand, null);
});

test('personalRecords finds the max weight, best est. 1RM, best set volume, and session count', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 55, reps: 8 }] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }, { weight: 65, reps: 3 }] }]),
  ];
  const pr = personalRecords(workouts, 'bench-press');
  assert.equal(pr.maxWeight, 65);
  assert.equal(pr.bestSetVolume, 60 * 8); // 480 beats 65*3=195 and 55*8=440
  assert.equal(pr.timesLogged, 2);
  // Epley 1RM: 60*(1+8/30)=76, 65*(1+3/30)=71.5, 55*(1+8/30)=69.67 -> best is 76
  assert.equal(pr.best1RM, 76);
});

test('personalRecords includes reps-only bodyweight sets and adds the user\'s bodyweight', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'dip', sets: [{ reps: 12 }] }]), // bodyweight only, no weight typed
    makeWorkout('2026-08-10', [{ exerciseId: 'dip', sets: [{ weight: 15, reps: 6 }] }]), // +15kg weighted
  ];
  const pr = personalRecords(workouts, 'dip', undefined, 80);
  assert.equal(pr.maxWeight, 95); // 80 + 15
  assert.equal(pr.timesLogged, 2);
});

test('personalRecords for a bodyweight exercise with no bodyweight set falls back to just the entered weight', () => {
  const workouts = [makeWorkout('2026-08-01', [{ exerciseId: 'dip', sets: [{ weight: 10, reps: 6 }] }])];
  const pr = personalRecords(workouts, 'dip');
  assert.equal(pr.maxWeight, 10);
});

test('personalRecords returns null for an exercise never logged', () => {
  assert.equal(personalRecords([], 'bench-press'), null);
});

test('personalRecords ignores warm-up sets when finding the best weight', () => {
  const workouts = [
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [
      { weight: 100, reps: 5, type: 'warmup' }, // heavier than the working set, but shouldn't win
      { weight: 60, reps: 8, type: 'normal' },
    ] }]),
  ];
  const pr = personalRecords(workouts, 'bench-press');
  assert.equal(pr.maxWeight, 60);
});

test('workoutSummaryByExercise reports sets/reps/volume per exercise, warm-ups excluded', () => {
  const w = makeWorkout('2026-08-18', [
    { exerciseId: 'bench-press', sets: [
      { weight: 20, reps: 10, type: 'warmup' },
      { weight: 60, reps: 8, type: 'normal' },
      { weight: 60, reps: 6, type: 'normal' },
    ] },
    { exerciseId: 'squat', sets: [{ weight: 80, reps: 5, type: 'normal' }] },
  ]);
  const summary = workoutSummaryByExercise(w);
  assert.deepEqual(summary, [
    { exerciseId: 'bench-press', name: 'Bench Press', setCount: 2, totalReps: 14, volume: 60 * 8 + 60 * 6, supersetId: null },
    { exerciseId: 'squat', name: 'Back Squat', setCount: 1, totalReps: 5, volume: 80 * 5, supersetId: null },
  ]);
});

test('workoutSummaryByExercise carries supersetId through unchanged', () => {
  const w = makeWorkout('2026-08-18', [
    { exerciseId: 'bench-press', supersetId: 'superset-1', sets: [{ weight: 60, reps: 8, type: 'normal' }] },
    { exerciseId: 'squat', supersetId: 'superset-1', sets: [{ weight: 80, reps: 5, type: 'normal' }] },
    { exerciseId: 'bench-press', sets: [{ weight: 40, reps: 10, type: 'normal' }] },
  ]);
  const summary = workoutSummaryByExercise(w);
  assert.equal(summary[0].supersetId, 'superset-1');
  assert.equal(summary[1].supersetId, 'superset-1');
  assert.equal(summary[2].supersetId, null);
});

test('workoutSummaryByExercise adds the user\'s bodyweight for a Bodyweight-equipment exercise', () => {
  const w = makeWorkout('2026-08-18', [
    { exerciseId: 'dip', sets: [{ reps: 10, type: 'normal' }, { weight: 20, reps: 6, type: 'normal' }] },
  ]);
  const summary = workoutSummaryByExercise(w, undefined, 80);
  assert.deepEqual(summary[0], {
    exerciseId: 'dip', name: 'Dip', setCount: 2, totalReps: 16, volume: 80 * 10 + 100 * 6, supersetId: null,
  });
});

test('workoutSummaryByExercise falls back to the raw id for an unknown exercise', () => {
  const w = makeWorkout('2026-08-18', [
    { exerciseId: 'not-a-real-exercise', sets: [{ weight: 10, reps: 10, type: 'normal' }] },
  ]);
  assert.equal(workoutSummaryByExercise(w)[0].name, 'not-a-real-exercise');
});

test('exerciseProgress picks the heaviest set per workout date, sorted oldest to newest', () => {
  const workouts = [
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }, { weight: 65, reps: 3 }] }]),
    makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 55, reps: 8 }] }]),
  ];
  const series = exerciseProgress(workouts, 'bench-press');
  assert.deepEqual(series, [
    { date: '2026-08-01', value: 55, reps: 8 },
    { date: '2026-08-10', value: 65, reps: 3 },
  ]);
});

test('newPRsInWorkout flags an exercise that beat its previous best weight', () => {
  const older = makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]);
  const newest = makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 65, reps: 5 }] }]);
  const workouts = [older, newest];
  const prs = newPRsInWorkout(workouts, newest);
  assert.deepEqual(prs, [{
    exerciseId: 'bench-press', name: 'Bench Press', weight: 65, previousWeight: 60,
  }]);
});

test('newPRsInWorkout does not count a first-time exercise as a PR (nothing to beat)', () => {
  const first = makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]);
  assert.deepEqual(newPRsInWorkout([first], first), []);
});

test('newPRsInWorkout excludes an exercise that did not beat its previous best', () => {
  const older = makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 65, reps: 5 }] }]);
  const newest = makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]);
  const workouts = [older, newest];
  assert.deepEqual(newPRsInWorkout(workouts, newest), []);
});

test('newPRsInWorkout can report multiple exercises PR-ing in the same workout', () => {
  const older = makeWorkout('2026-08-01', [
    { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] },
    { exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] },
  ]);
  const newest = makeWorkout('2026-08-10', [
    { exerciseId: 'bench-press', sets: [{ weight: 65, reps: 5 }] },
    { exerciseId: 'squat', sets: [{ weight: 110, reps: 3 }] },
  ]);
  const workouts = [older, newest];
  const prs = newPRsInWorkout(workouts, newest);
  assert.equal(prs.length, 2);
  assert.ok(prs.some((p) => p.exerciseId === 'bench-press' && p.weight === 65));
  assert.ok(prs.some((p) => p.exerciseId === 'squat' && p.weight === 110));
});

test('newPRsInWorkout adds the user\'s bodyweight before comparing, for bodyweight exercises', () => {
  const older = makeWorkout('2026-08-01', [{ exerciseId: 'dip', sets: [{ reps: 10 }] }]); // 80kg bodyweight-only
  const newest = makeWorkout('2026-08-10', [{ exerciseId: 'dip', sets: [{ weight: 10, reps: 6 }] }]); // 90kg with +10
  const workouts = [older, newest];
  const prs = newPRsInWorkout(workouts, newest, undefined, 80);
  assert.deepEqual(prs, [{
    exerciseId: 'dip', name: 'Dip', weight: 90, previousWeight: 80,
  }]);
});

test('exerciseVolumeProgress sums weight x reps per workout date, sorted oldest to newest', () => {
  const workouts = [
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }, { weight: 65, reps: 3 }] }]),
    makeWorkout('2026-08-01', [{ exerciseId: 'bench-press', sets: [{ weight: 55, reps: 8 }] }]),
  ];
  const series = exerciseVolumeProgress(workouts, 'bench-press');
  assert.deepEqual(series, [
    { date: '2026-08-01', value: 55 * 8 },
    { date: '2026-08-10', value: 60 * 8 + 65 * 3 },
  ]);
});

test('exerciseVolumeProgress excludes warm-up sets, matching workoutVolume\'s convention', () => {
  const workouts = [makeWorkout('2026-08-10', [{
    exerciseId: 'bench-press',
    sets: [{ weight: 40, reps: 10, type: 'warmup' }, { weight: 60, reps: 8 }],
  }])];
  assert.deepEqual(exerciseVolumeProgress(workouts, 'bench-press'), [{ date: '2026-08-10', value: 60 * 8 }]);
});

test('exerciseVolumeProgress adds the user\'s bodyweight for bodyweight exercises', () => {
  const workouts = [makeWorkout('2026-08-10', [{ exerciseId: 'dip', sets: [{ reps: 10 }] }])];
  assert.deepEqual(exerciseVolumeProgress(workouts, 'dip', undefined, 80), [{ date: '2026-08-10', value: 80 * 10 }]);
});

test('personalRecords, exerciseProgress and exerciseVolumeProgress filter to only the given brand', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'leg-press', brand: 'Precor', sets: [{ weight: 100, reps: 10 }] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'leg-press', brand: 'Life Fitness', sets: [{ weight: 150, reps: 5 }] }]),
  ];
  assert.equal(personalRecords(workouts, 'leg-press', undefined, null, 'Precor').maxWeight, 100);
  assert.deepEqual(exerciseProgress(workouts, 'leg-press', undefined, null, 'Precor'), [{ date: '2026-08-01', value: 100, reps: 10 }]);
  assert.deepEqual(exerciseVolumeProgress(workouts, 'leg-press', undefined, null, 'Precor'), [{ date: '2026-08-01', value: 1000 }]);
  // no brand filter -> both sessions included
  assert.equal(personalRecords(workouts, 'leg-press').maxWeight, 150);
});

test('loggedBrandsForExercise lists distinct brands logged for an exercise, alphabetically', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'leg-press', brand: 'Precor', sets: [{ weight: 100, reps: 10 }] }]),
    makeWorkout('2026-08-05', [{ exerciseId: 'leg-press', brand: 'Precor', sets: [{ weight: 105, reps: 8 }] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'leg-press', brand: 'Life Fitness', sets: [{ weight: 110, reps: 8 }] }]),
    makeWorkout('2026-08-12', [{ exerciseId: 'leg-press', sets: [{ weight: 110, reps: 8 }] }]), // no brand logged
  ];
  assert.deepEqual(loggedBrandsForExercise(workouts, 'leg-press'), ['Life Fitness', 'Precor']);
});

test('loggedBrandsForExercise returns an empty list when nothing has been logged', () => {
  assert.deepEqual(loggedBrandsForExercise([], 'leg-press'), []);
});

test('volumeSince adds the user\'s bodyweight for bodyweight exercises within the window', () => {
  const workouts = [makeWorkout('2026-08-18', [{ exerciseId: 'dip', sets: [{ reps: 10 }] }])];
  assert.equal(volumeSince(workouts, 7, '2026-08-18', undefined, 80), 80 * 10);
});

test('exerciseProgress adds the user\'s bodyweight for bodyweight exercises', () => {
  const workouts = [makeWorkout('2026-08-10', [{ exerciseId: 'dip', sets: [{ reps: 10 }] }])];
  const series = exerciseProgress(workouts, 'dip', undefined, 80);
  assert.deepEqual(series, [{ date: '2026-08-10', value: 80, reps: 10 }]);
});

test('loggedExerciseIds lists exercises most-recently-performed first', () => {
  const workouts = [
    makeWorkout('2026-08-01', [{ exerciseId: 'squat', sets: [] }]),
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [] }]),
  ];
  assert.deepEqual(loggedExerciseIds(workouts), ['bench-press', 'squat']);
});

test('daysSinceLastWorkout looks at the most recent workout date', () => {
  const workouts = [makeWorkout('2026-08-01', []), makeWorkout('2026-08-10', [])];
  assert.equal(daysSinceLastWorkout(workouts, '2026-08-15'), 5);
  assert.equal(daysSinceLastWorkout([]), null);
});

test('volumeSince sums workout volume within the trailing window, inclusive of today', () => {
  const workouts = [
    makeWorkout('2026-08-10', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]), // 8 days back from 08-18: outside a 7-day window
    makeWorkout('2026-08-15', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]), // within window
    makeWorkout('2026-08-18', [{ exerciseId: 'squat', sets: [{ weight: 80, reps: 5 }] }]), // today, within window
  ];
  assert.equal(volumeSince(workouts, 7, '2026-08-18'), 60 * 8 + 80 * 5);
});

// 2026-08-18 is a Tuesday, so its Monday-start week begins 2026-08-17.
const RANGE_WORKOUTS = [
  makeWorkout('2026-08-17', [{ exerciseId: 'squat', sets: [{ weight: 80, reps: 5 }] }]), // this week
  makeWorkout('2026-08-16', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]), // last week, this month
  makeWorkout('2026-07-31', [{ exerciseId: 'barbell-curl', sets: [{ weight: 20, reps: 10 }] }]), // last month, this year
  makeWorkout('2025-12-25', [{ exerciseId: 'deadlift', sets: [{ weight: 100, reps: 5 }] }]), // last year
];

function breakdownFor(range) {
  const rows = muscleSetBreakdown(RANGE_WORKOUTS, range, '2026-08-18');
  return Object.fromEntries(rows.map((r) => [r.muscle, r.sets]));
}

test('muscleSetBreakdown returns every radar group, RADAR_GROUPS order, zero included', () => {
  const rows = muscleSetBreakdown([], 'all', '2026-08-18');
  assert.deepEqual(rows.map((r) => r.muscle), RADAR_GROUPS);
  assert.ok(rows.every((r) => r.sets === 0));
});

test('muscleSetBreakdown "week" only includes workouts from the Monday-start current week', () => {
  const counts = breakdownFor('week');
  assert.equal(counts.quads, 1); // squat -> quads, glutes
  assert.equal(counts.glutes, 1);
  assert.equal(counts.chest, 0);
  assert.equal(counts.arms, 0);
  assert.equal(counts.back, 0);
});

test('muscleSetBreakdown "month" includes the whole current calendar month', () => {
  const counts = breakdownFor('month');
  assert.equal(counts.quads, 1); // squat
  // bench-press -> mid-chest/triceps/front-delts, rolled up into chest/arms/shoulders
  assert.equal(counts.chest, 1);
  assert.equal(counts.arms, 1);
  assert.equal(counts.shoulders, 1);
  assert.equal(counts.back, 0); // deadlift (last year) and barbell-curl (last month) excluded
});

test('muscleSetBreakdown "year" includes the whole current calendar year', () => {
  const counts = breakdownFor('year');
  assert.equal(counts.quads, 1);
  assert.equal(counts.chest, 1);
  // arms now gets bench-press's triceps AND barbell-curl's biceps (both this year)
  assert.equal(counts.arms, 2);
  assert.equal(counts.back, 0); // deadlift is last year, still excluded
});

test('muscleSetBreakdown "all" includes every workout regardless of date', () => {
  const counts = breakdownFor('all');
  assert.equal(counts.quads, 1);
  assert.equal(counts.arms, 2);
  assert.equal(counts.back, 1); // deadlift -> lower-back
  assert.equal(counts.hamstrings, 1); // deadlift
  assert.equal(counts.glutes, 2); // squat + deadlift both work glutes
});

test('muscleSetBreakdown credits every radar group an exercise\'s muscles roll up into, not just the primary one', () => {
  const workouts = [makeWorkout('2026-08-18', [
    { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] },
  ])];
  const counts = Object.fromEntries(
    muscleSetBreakdown(workouts, 'all', '2026-08-18').map((r) => [r.muscle, r.sets]),
  );
  assert.equal(counts.chest, 1); // mid-chest
  assert.equal(counts.arms, 1); // triceps
  assert.equal(counts.shoulders, 1); // front-delts
});

test('muscleSetBreakdown ignores sets missing both weight and reps', () => {
  const workouts = [makeWorkout('2026-08-18', [
    { exerciseId: 'squat', sets: [{ weight: null, reps: null }] },
  ])];
  const counts = Object.fromEntries(
    muscleSetBreakdown(workouts, 'all', '2026-08-18').map((r) => [r.muscle, r.sets]),
  );
  assert.equal(counts.quads, 0);
});

test('muscleSetBreakdown skips exercises no longer in the library rather than crashing', () => {
  const workouts = [makeWorkout('2026-08-18', [
    { exerciseId: 'not-a-real-exercise', sets: [{ weight: 10, reps: 10 }] },
  ])];
  assert.doesNotThrow(() => muscleSetBreakdown(workouts, 'all', '2026-08-18'));
});

test('muscleSetBreakdownDetailed returns every fine-grained muscle, MUSCLES order, zero included', () => {
  const rows = muscleSetBreakdownDetailed([], 'all', '2026-08-18');
  assert.deepEqual(rows.map((r) => r.muscle), MUSCLES);
  assert.ok(rows.every((r) => r.sets === 0));
});

test('muscleSetBreakdownDetailed credits every fine-grained muscle a bench press targets', () => {
  const workouts = [makeWorkout('2026-08-18', [
    { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] },
  ])];
  const counts = Object.fromEntries(
    muscleSetBreakdownDetailed(workouts, 'all', '2026-08-18').map((r) => [r.muscle, r.sets]),
  );
  assert.equal(counts['mid-chest'], 1);
  assert.equal(counts.triceps, 1);
  assert.equal(counts['front-delts'], 1);
  assert.equal(counts.biceps, 0);
});

test('muscleSetBreakdown is exactly muscleSetBreakdownDetailed rolled up by RADAR_GROUP_FOR', () => {
  const workouts = [
    makeWorkout('2026-08-17', [{ exerciseId: 'squat', sets: [{ weight: 80, reps: 5 }] }]),
    makeWorkout('2026-08-16', [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }]),
  ];
  const detailed = muscleSetBreakdownDetailed(workouts, 'all', '2026-08-18');
  const expected = new Map(RADAR_GROUPS.map((g) => [g, 0]));
  for (const { muscle, sets } of detailed) {
    const group = RADAR_GROUP_FOR[muscle];
    expected.set(group, expected.get(group) + sets);
  }
  const actual = muscleSetBreakdown(workouts, 'all', '2026-08-18');
  assert.deepEqual(actual, RADAR_GROUPS.map((muscle) => ({ muscle, sets: expected.get(muscle) })));
});
