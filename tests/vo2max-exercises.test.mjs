import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISES, MUSCLES, EQUIPMENT, RADAR_GROUPS, RADAR_GROUP_FOR, MUSCLE_LABEL,
  exerciseById, searchExercises,
} from '../vo2max/js/exercises.js';

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

test('exerciseById and searchExercises accept an optional list, e.g. built-ins plus custom exercises', () => {
  const custom = { id: 'custom-abc', name: 'My Cable Thing', equipment: 'Cable', muscles: ['core'] };
  const combined = [...EXERCISES, custom];
  assert.equal(exerciseById('custom-abc'), null); // not in the built-in library alone
  assert.equal(exerciseById('custom-abc', combined).name, 'My Cable Thing');
  assert.ok(searchExercises('cable thing', undefined, combined).some((e) => e.id === 'custom-abc'));
});

test('MUSCLES includes Abductors and Adductors', () => {
  assert.ok(MUSCLES.includes('abductors'));
  assert.ok(MUSCLES.includes('adductors'));
  assert.equal(MUSCLE_LABEL.abductors, 'Abductors');
  assert.equal(MUSCLE_LABEL.adductors, 'Adductors');
});

test('EQUIPMENT includes the standard equipment types', () => {
  for (const eq of ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Band']) {
    assert.ok(EQUIPMENT.includes(eq), `EQUIPMENT is missing "${eq}"`);
  }
});

test('every exercise uses a known equipment type', () => {
  for (const e of EXERCISES) {
    assert.ok(EQUIPMENT.includes(e.equipment), `${e.id} uses unknown equipment "${e.equipment}"`);
  }
});

test('every MUSCLES id rolls up into a valid RADAR_GROUPS id', () => {
  for (const m of MUSCLES) {
    const group = RADAR_GROUP_FOR[m];
    assert.ok(group, `"${m}" has no RADAR_GROUP_FOR entry`);
    assert.ok(RADAR_GROUPS.includes(group), `"${m}" maps to unknown radar group "${group}"`);
  }
});
