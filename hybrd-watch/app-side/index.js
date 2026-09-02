import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_SETTINGS, MAX_WORKOUT_HISTORY } from '../utils/constants'
import { pushWorkoutsToGist } from './gist'

const WORKOUTS_KEY = 'watchWorkouts'
const CUSTOM_EXERCISES_KEY = 'customExercises'

function getSettings() {
  const settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const raw = settingsLib.getItem(key)
    // Trimmed defensively - a pasted Gist ID or token with a stray
    // leading/trailing space or newline (easy to pick up copying from a
    // URL bar) silently breaks the GitHub API URL/header and shows up as
    // a 404, not an obviously-a-typo error.
    if (raw && raw.trim()) settings[key] = raw.trim()
  }
  return settings
}

function loadWorkouts() {
  try {
    const raw = settingsLib.getItem(WORKOUTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveWorkouts(workouts) {
  settingsLib.setItem(WORKOUTS_KEY, JSON.stringify(workouts))
}

/** Exercises added from the phone's Watch settings page (see
 *  setting/index.js) - stored there as the same JSON array under this key,
 *  settingsStorage/settingsLib being the one thing both ends can read. */
function loadCustomExercises() {
  try {
    const raw = settingsLib.getItem(CUSTOM_EXERCISES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getCustomExercises(res) {
  res(null, { exercises: loadCustomExercises() })
}

/** Pushes the full local history (and the current custom exercise list, so
 *  the phone can register any it's missing) to the configured Gist.
 *  Returns an error message string on failure (including "not configured"),
 *  or null on success - never throws, so a save always completes locally
 *  regardless of what happens here. */
async function trySyncToGist(workouts) {
  const settings = getSettings()
  if (!settings.gistId || !settings.githubToken) return 'Gist ID or token not set in this watch\'s settings'
  try {
    await pushWorkoutsToGist(settings.gistId, settings.githubToken, workouts, loadCustomExercises())
    return null
  } catch (err) {
    return `${err.status ? `HTTP ${err.status}` : 'network error'}: ${err.message}`
  }
}

async function saveWorkout(res, workout) {
  const workouts = [workout, ...loadWorkouts()].slice(0, MAX_WORKOUT_HISTORY)
  saveWorkouts(workouts)
  const syncError = await trySyncToGist(workouts)
  res(null, { ok: true, syncError })
}

async function syncNow(res) {
  const syncError = await trySyncToGist(loadWorkouts())
  res(null, { syncError })
}

/** The weight/reps of the most recent logged set for `exerciseId`, from
 *  saved workout history (newest first - see saveWorkout above), for
 *  defaulting the stepper to what was actually lifted last time instead of
 *  a generic starting point. Null fields if this exercise has no history
 *  yet. */
function getLastSet(res, exerciseId) {
  for (const workout of loadWorkouts()) {
    const exercise = workout.exercises.find((e) => e.exerciseId === exerciseId)
    if (exercise && exercise.sets.length > 0) {
      const last = exercise.sets[exercise.sets.length - 1]
      res(null, { weight: last.weight, reps: last.reps })
      return
    }
  }
  res(null, { weight: null, reps: null })
}

function getWorkouts(res) {
  const workouts = loadWorkouts()
  res(null, {
    workouts: workouts.map((w) => ({
      date: w.date,
      name: w.name,
      exerciseCount: w.exercises.length,
      setCount: w.exercises.reduce((sum, e) => sum + e.sets.length, 0),
    })),
  })
}

function workoutVolume(workout) {
  let volume = 0
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) volume += (set.weight || 0) * (set.reps || 0)
  }
  return volume
}

function mondayOfThisWeek() {
  const now = new Date()
  const monday = new Date(now)
  const dayIndex = (now.getDay() + 6) % 7 // 0 = Monday
  monday.setDate(now.getDate() - dayIndex)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** The Today page's dashboard: days since your last watch-logged workout,
 *  that workout's name/exercise count, and total volume lifted this week
 *  (Monday-anchored) - all from local workout history, since (unlike
 *  intervals.icu for runs) there's no cloud source for lift data to pull
 *  from instead. Only reflects workouts logged from the watch itself, not
 *  ones logged on the phone - the sync only ever flows watch -> phone. */
function getLiftStatus(res) {
  const workouts = loadWorkouts()
  let daysSinceLastWorkout = null
  let lastWorkout = null
  if (workouts.length > 0) {
    const latest = workouts[0]
    const last = new Date(`${latest.date}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    daysSinceLastWorkout = Math.round((today - last) / 86400000)
    lastWorkout = { name: latest.name, exerciseCount: latest.exercises.length }
  }

  const monday = mondayOfThisWeek()
  const weekVolume = workouts
    .filter((w) => new Date(`${w.date}T00:00:00`) >= monday)
    .reduce((sum, w) => sum + workoutVolume(w), 0)

  res(null, { daysSinceLastWorkout, lastWorkout, weekVolume: Math.round(weekVolume) })
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRequest(req, res) {
      if (req.method === 'GET_LIFT_STATUS') {
        getLiftStatus(res)
      } else if (req.method === 'SAVE_WORKOUT') {
        saveWorkout(res, req.params)
      } else if (req.method === 'GET_WORKOUTS') {
        getWorkouts(res)
      } else if (req.method === 'GET_LAST_SET') {
        getLastSet(res, req.params)
      } else if (req.method === 'GET_CUSTOM_EXERCISES') {
        getCustomExercises(res)
      } else if (req.method === 'SYNC_NOW') {
        syncNow(res)
      }
    },
    onRun() {},
    onDestroy() {},
  })
)
