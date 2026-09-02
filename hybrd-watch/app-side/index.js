import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_SETTINGS, MAX_WORKOUT_HISTORY } from '../utils/constants'
import { zoneTable } from '../utils/zones'
import { fetchLatestWellness, fetchRunStatus } from './intervals'
import { pushWorkoutsToGist } from './gist'

const WORKOUTS_KEY = 'watchWorkouts'

function getSettings() {
  const settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key === 'primaryZoneModel') continue // derived below from the settings page's toggle
    const raw = settingsLib.getItem(key)
    if (raw == null || raw === '') continue
    settings[key] = typeof DEFAULT_SETTINGS[key] === 'number' ? Number(raw) : raw
  }
  settings.primaryZoneModel = settingsLib.getItem('useRhrZones') === 'true' ? 'rhr' : 'lthr'
  return settings
}

async function getStatus(res) {
  const settings = getSettings()
  if (!settings.intervalsAthleteId || !settings.intervalsApiKey) {
    res(null, { error: 'NOT_CONFIGURED' })
    return
  }
  try {
    const [wellness, runStatus] = await Promise.all([
      fetchLatestWellness(settings.intervalsAthleteId, settings.intervalsApiKey),
      fetchRunStatus(settings.intervalsAthleteId, settings.intervalsApiKey),
    ])
    const vo2max = wellness.vo2max
    res(null, {
      vo2max,
      vo2maxDelta: vo2max != null ? Math.round((vo2max - settings.baselineVO2max) * 10) / 10 : null,
      restingHR: wellness.restingHR,
      sleepHours: wellness.sleepHours,
      daysSinceLastRun: runStatus.daysSinceLastRun,
      weekKm: runStatus.weekKm,
      syncedAt: Date.now(),
    })
  } catch (err) {
    res(null, { error: err.status === 401 || err.status === 403 ? 'BAD_CREDENTIALS' : 'NETWORK_ERROR' })
  }
}

function getZones(res) {
  const settings = getSettings()
  const table = zoneTable(settings, settings.primaryZoneModel)
  res(null, {
    model: settings.primaryZoneModel,
    zones: table.map((z) => ({ name: z.name, low: z.bpmLow, high: z.bpmHigh, target: !!z.target })),
  })
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

/** Best-effort: pushes the full local history to the configured Gist.
 *  Never throws - a save always succeeds locally regardless of whether the
 *  network is reachable right now, and the next successful sync (after any
 *  future save) re-pushes the complete list anyway, so nothing is lost. */
async function trySyncToGist(workouts) {
  const settings = getSettings()
  if (!settings.gistId || !settings.githubToken) return
  try {
    await pushWorkoutsToGist(settings.gistId, settings.githubToken, workouts)
  } catch (err) {
    console.log(`gist sync failed: ${err.message}`)
  }
}

function saveWorkout(res, workout) {
  const workouts = [workout, ...loadWorkouts()].slice(0, MAX_WORKOUT_HISTORY)
  saveWorkouts(workouts)
  res(null, { ok: true })
  trySyncToGist(workouts)
}

/** The weight/reps of the most recent logged set for `exerciseId`, from
 *  saved workout history (newest first - see saveWorkout below), for
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

AppSideService(
  BaseSideService({
    onInit() {},
    onRequest(req, res) {
      if (req.method === 'GET_STATUS') {
        getStatus(res)
      } else if (req.method === 'GET_ZONES') {
        getZones(res)
      } else if (req.method === 'SAVE_WORKOUT') {
        saveWorkout(res, req.params)
      } else if (req.method === 'GET_WORKOUTS') {
        getWorkouts(res)
      } else if (req.method === 'GET_LAST_SET') {
        getLastSet(res, req.params)
      }
    },
    onRun() {},
    onDestroy() {},
  })
)
