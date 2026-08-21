import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, exerciseById, searchExercises } from '../vo2max/js/exercises.js';

test('every exercise has a unique id', () => {
  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every exercise references only known muscle groups', () => {
  for (const e of EXERCISES) {
    assert.ok(e.muscles.length > 0, `${e.id} has no muscles`);
    for (const m of e.muscles) {
      assert.ok(MUSCLES.includes(m), `${e.id} references unknown muscle "${m}"`);
    }
  }
});

test('every muscle group has at least one exercise', () => {
  for (const m of MUSCLES) {
    assert.ok(EXERCISES.some((e) => e.muscles.includes(m)), `no exercise works "${m}"`);
  }
});

test('exerciseById finds an exercise by id, or null', () => {
  assert.equal(exerciseById('bench-press').name, 'Bench Press');
  assert.equal(exerciseById('not-a-real-exercise'), null);
});

test('searchExercises filters by name (case-insensitive) and by muscle group', () => {
  assert.ok(searchExercises('bench').every((e) => e.name.toLowerCase().includes('bench')));
  assert.ok(searchExercises('BENCH').length > 0);
  assert.ok(searchExercises('', 'biceps').every((e) => e.muscles.includes('biceps')));
  assert.ok(searchExercises('curl', 'biceps').every((e) => e.muscles.includes('biceps') && e.name.toLowerCase().includes('curl')));
});
