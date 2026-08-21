/*
 * Pure functions for strength-workout logging: PRs, progress series, volume,
 * last-performance lookups. Mirrors block.js's role for the cardio side.
 */

import { todayIso } from './block.js';
import {
  EXERCISES, RADAR_GROUPS, RADAR_GROUP_FOR, exerciseById,
} from './exercises.js';

const DAY_MS = 86400000;
const toDate = (iso) => new Date(`${iso}T00:00:00`);

/** Total weight x reps across every completed set in one workout. */
export function workoutVolume(workout) {
  return (workout.exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
    0,
  );
}

/** Every logged set for one exercise across all workouts, oldest first. */
function setsForExercise(workouts, exerciseId) {
  const out = [];
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const ex = (w.exercises || []).find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    for (const set of ex.sets || []) {
      if (set.weight == null || set.reps == null) continue;
      out.push({ date: w.date, weight: set.weight, reps: set.reps });
    }
  }
  return out;
}

/** The most recent workout's sets for this exercise, for a "last time" hint while logging. */
export function lastPerformance(workouts, exerciseId) {
  const withThis = [...workouts]
    .filter((w) => (w.exercises || []).some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!withThis.length) return null;
  const ex = withThis[0].exercises.find((e) => e.exerciseId === exerciseId);
  return {
    date: withThis[0].date,
    sets: (ex.sets || []).filter((s) => s.weight != null && s.reps != null),
  };
}

/** Epley estimated 1-rep max. */
function estOneRM(weight, reps) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

/** Best weight, best estimated 1RM, best single-set volume, and how many sessions this exercise has appeared in. */
export function personalRecords(workouts, exerciseId) {
  const sets = setsForExercise(workouts, exerciseId);
  if (!sets.length) return null;
  return {
    maxWeight: Math.max(...sets.map((s) => s.weight)),
    best1RM: Math.round(Math.max(...sets.map((s) => estOneRM(s.weight, s.reps))) * 10) / 10,
    bestSetVolume: Math.max(...sets.map((s) => s.weight * s.reps)),
    timesLogged: new Set(sets.map((s) => s.date)).size,
  };
}

/** One point per workout date this exercise appears in (that day's heaviest set), for a progress chart. */
export function exerciseProgress(workouts, exerciseId) {
  const sets = setsForExercise(workouts, exerciseId);
  const byDate = new Map();
  for (const s of sets) {
    const prev = byDate.get(s.date);
    if (!prev || s.weight > prev.weight) byDate.set(s.date, s);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, value: s.weight, reps: s.reps }));
}

/** Every exercise id logged at least once, most-recently-performed first. */
export function loggedExerciseIds(workouts) {
  const lastSeen = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if (!lastSeen.has(ex.exerciseId) || w.date > lastSeen.get(ex.exerciseId)) {
        lastSeen.set(ex.exerciseId, w.date);
      }
    }
  }
  return [...lastSeen.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id);
}

export function daysSinceLastWorkout(workouts, now = todayIso()) {
  if (workouts.length === 0) return null;
  const last = [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0];
  return Math.round((toDate(now) - toDate(last.date)) / DAY_MS);
}

/** Total volume (weight x reps) logged within the last `days` days, inclusive of today. */
export function volumeSince(workouts, days, now = todayIso()) {
  const cutoff = toDate(now).getTime() - (days - 1) * DAY_MS;
  return Math.round(
    workouts
      .filter((w) => toDate(w.date).getTime() >= cutoff)
      .reduce((sum, w) => sum + workoutVolume(w), 0),
  );
}

/** Local midnight the current 'week'|'month'|'year' range started; null for 'all'. */
function rangeStart(range, now) {
  const base = toDate(now);
  if (range === 'week') {
    const dayIdx = (base.getDay() + 6) % 7; // 0 = Monday
    const d = new Date(base);
    d.setDate(d.getDate() - dayIdx);
    return d;
  }
  if (range === 'month') return new Date(base.getFullYear(), base.getMonth(), 1);
  if (range === 'year') return new Date(base.getFullYear(), 0, 1);
  return null;
}

/**
 * Sets logged per general body region within `range`
 * ('week'|'month'|'year'|'all'), for the muscle-balance radar chart. Each
 * exercise's fine-grained muscles (see exercises.js's MUSCLES) roll up into
 * one of RADAR_GROUPS via RADAR_GROUP_FOR - a chart with 22 spokes isn't
 * readable, so this deliberately trades granularity for a chart that is. A
 * set is counted once for every group its exercise reaches (an exercise's
 * `muscles` list may span several), so a compound lift like a bench press
 * credits chest, arms and shoulders alike rather than only its primary
 * muscle. Returns one entry per RADAR_GROUPS id, zero included, in order.
 * @param {typeof EXERCISES} [exercises] defaults to the built-in library;
 *   pass a list that also includes the user's custom exercises to credit
 *   sets logged against those too.
 */
export function muscleSetBreakdown(workouts, range, now = todayIso(), exercises = EXERCISES) {
  const start = rangeStart(range, now);
  const counts = new Map(RADAR_GROUPS.map((g) => [g, 0]));
  for (const w of workouts) {
    if (start && toDate(w.date) < start) continue;
    for (const ex of w.exercises || []) {
      const def = exerciseById(ex.exerciseId, exercises);
      if (!def) continue;
      const setCount = (ex.sets || []).filter((s) => s.weight != null || s.reps != null).length;
      if (!setCount) continue;
      for (const m of def.muscles) {
        const group = RADAR_GROUP_FOR[m];
        if (group) counts.set(group, (counts.get(group) || 0) + setCount);
      }
    }
  }
  return RADAR_GROUPS.map((muscle) => ({ muscle, sets: counts.get(muscle) }));
}
