/*
 * The in-progress workout while the user moves between the hub, group,
 * exercise and set-entry pages logging it. Lives in the app's globalData
 * (see app.js) rather than any one page's state, since Zepp OS tears a
 * page's own state down when you navigate away from it - globalData is the
 * one thing that survives push()/back()/replace() across that page chain.
 *
 * It's also mirrored to a local file on every change (see persist() below)
 * and restored from there in app.js's onCreate, so quitting the watch app
 * mid-workout and reopening it picks back up where you left off instead of
 * losing everything - globalData alone only survives while the app process
 * itself is still alive, not a full quit/relaunch.
 */

import { readFileSync, writeFileSync, rmSync, statSync } from '@zos/fs'

const LIVE_WORKOUT_FILE = 'live-workout.json'

function persist(workout) {
  if (workout) {
    writeFileSync({ path: LIVE_WORKOUT_FILE, data: JSON.stringify(workout), options: { encoding: 'utf8' } })
  } else if (statSync({ path: LIVE_WORKOUT_FILE })) {
    rmSync({ path: LIVE_WORKOUT_FILE })
  }
}

/** Called once from app.js's onCreate to restore whatever was in progress
 *  the last time the app quit (or crashed) mid-workout. */
export function loadPersistedWorkout() {
  if (!statSync({ path: LIVE_WORKOUT_FILE })) return null
  try {
    const raw = readFileSync({ path: LIVE_WORKOUT_FILE, options: { encoding: 'utf8' } })
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getLiveWorkout() {
  return getApp()._options.globalData.liveWorkout
}

export function startLiveWorkout() {
  const workout = { date: today(), name: '', notes: '', exercises: [], startedAt: Date.now() }
  getApp()._options.globalData.liveWorkout = workout
  persist(workout)
  return workout
}

export function discardLiveWorkout() {
  getApp()._options.globalData.liveWorkout = null
  persist(null)
}

/** Adds one set to the given exercise within the live workout, creating
 *  that exercise's entry (at the end of the list) on first use - `name` is
 *  only used then, so any later call for an exercise already in this
 *  workout can pass whatever, it's ignored. No-op if nothing is in
 *  progress. */
export function addSet(exerciseId, name, set) {
  const workout = getLiveWorkout()
  if (!workout) return
  let exercise = workout.exercises.find((e) => e.exerciseId === exerciseId)
  if (!exercise) {
    exercise = { exerciseId, name, supersetId: null, brand: null, sets: [] }
    workout.exercises.push(exercise)
  }
  exercise.sets.push(set)
  persist(workout)
}

/** The most recently logged set for an exercise within the live workout,
 *  used to default the next set's weight/reps - most sets in a row share
 *  the same weight, so this saves re-stepping to it each time. */
export function lastSet(exerciseId) {
  const workout = getLiveWorkout()
  const exercise = workout?.exercises.find((e) => e.exerciseId === exerciseId)
  if (!exercise || exercise.sets.length === 0) return null
  return exercise.sets[exercise.sets.length - 1]
}

export function setCountFor(exerciseId) {
  const workout = getLiveWorkout()
  const exercise = workout?.exercises.find((e) => e.exerciseId === exerciseId)
  return exercise ? exercise.sets.length : 0
}

export function totalSetCount() {
  const workout = getLiveWorkout()
  if (!workout) return 0
  return workout.exercises.reduce((sum, e) => sum + e.sets.length, 0)
}

export function totalVolume() {
  const workout = getLiveWorkout()
  if (!workout) return 0
  let volume = 0
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) volume += (set.weight || 0) * (set.reps || 0)
  }
  return Math.round(volume)
}

export function elapsedMs() {
  const workout = getLiveWorkout()
  if (!workout?.startedAt) return 0
  return Date.now() - workout.startedAt
}

/** Swaps exercise `index` with its neighbor in the given direction (-1 up,
 *  +1 down). No-op at either end of the list. */
export function moveExercise(index, direction) {
  const workout = getLiveWorkout()
  if (!workout) return
  const target = index + direction
  if (target < 0 || target >= workout.exercises.length) return
  const [item] = workout.exercises.splice(index, 1)
  workout.exercises.splice(target, 0, item)
  persist(workout)
}

export function removeExercise(index) {
  const workout = getLiveWorkout()
  if (!workout) return
  workout.exercises.splice(index, 1)
  persist(workout)
}

/** Pairs exercise `index` with the NEXT one as a superset (same
 *  supersetId), or un-pairs them if already paired - supersets are always
 *  adjacent pairs in this simplified watch flow, unlike the phone app
 *  which allows any grouping; a synced workout still reads correctly there
 *  either way, since it only looks at whether ids match. No-op if there's
 *  no next exercise. */
export function toggleSupersetWithNext(index) {
  const workout = getLiveWorkout()
  if (!workout) return
  const a = workout.exercises[index]
  const b = workout.exercises[index + 1]
  if (!a || !b) return
  if (a.supersetId && a.supersetId === b.supersetId) {
    a.supersetId = null
    b.supersetId = null
  } else {
    const id = `ss-${Date.now().toString(36)}`
    a.supersetId = id
    b.supersetId = id
  }
  persist(workout)
}

function makeId() {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Finalizes the live workout for saving - stamps a stable watchWorkoutId
 *  (see ../../hybrd-app/js/gistSync.js for how the phone dedups on this),
 *  drops the watch-only `name` field each exercise carries (the phone
 *  resolves display names from exerciseId itself), and clears the
 *  in-progress state. Returns null if nothing was in progress or nothing
 *  was ever logged. Read whatever summary stats you need (elapsedMs(),
 *  totalVolume(), etc.) BEFORE calling this - they all return zero/empty
 *  once the live workout is cleared. */
export function finishLiveWorkout() {
  const workout = getLiveWorkout()
  if (!workout || workout.exercises.length === 0) return null
  const { startedAt, ...rest } = workout
  const finished = {
    ...rest,
    exercises: rest.exercises.map(({ name, ...exercise }) => exercise),
    watchWorkoutId: makeId(),
  }
  discardLiveWorkout()
  return finished
}

export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
