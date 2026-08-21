import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workoutVolume, lastPerformance, personalRecords, exerciseProgress,
  loggedExerciseIds, daysSinceLastWorkout, volumeSince,
} from '../vo2max/js/workout.js';

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
