import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workoutVolume, lastPerformance, personalRecords, exerciseProgress,
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
    { exerciseId: 'bench-press', name: 'Bench Press', setCount: 2, totalReps: 14, volume: 60 * 8 + 60 * 6 },
    { exerciseId: 'squat', name: 'Back Squat', setCount: 1, totalReps: 5, volume: 80 * 5 },
  ]);
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
