/*
 * Pushes locally-logged workouts to a GitHub Gist so the phone app can pick
 * them up - same "personal token, no backend" shape as the intervals.icu
 * bridge, since the watch's side-service and the phone browser's
 * localStorage are otherwise two sandboxes with no way to reach each other.
 * The watch always pushes its *full* local workout history (not just new
 * ones); the phone dedups on read by watchWorkoutId. See setting/index.js
 * and ../../hybrd-app/js/gistSync.js for the two ends of this.
 *
 * Deleting a workout on the phone writes its id to the Gist's
 * deletedWorkoutIds list (the phone's one write - see gistSync.js's
 * markWorkoutDeleted) instead of removing it from `workouts` there
 * directly, since the watch is the one that owns that field. fetchGistState
 * below is how the watch notices - see app-side/index.js's reconcile step,
 * which runs before every push and removes matching entries from the
 * watch's own local history. The push always echoes deletedWorkoutIds back
 * unchanged, so a watch push can never accidentally erase a deletion the
 * phone recorded before the watch got a chance to act on it.
 */

const GITHUB_API = 'https://api.github.com'
const GIST_FILE = 'hybrd-workouts.json'

async function request(method, gistId, token, body) {
  const res = await fetch({
    url: `${GITHUB_API}/gists/${gistId}`,
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hybrd-watch', // GitHub's API rejects requests with no User-Agent
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`GitHub Gist API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body
}

/** The deletedWorkoutIds the phone has recorded (see gistSync.js's
 *  markWorkoutDeleted) - everything else in the Gist is the watch's own
 *  data, already known locally, so there's nothing else worth reading. */
export async function fetchDeletedWorkoutIds(gistId, token) {
  const gist = await request('GET', gistId, token)
  const file = gist.files?.[GIST_FILE]
  if (!file) return []
  let content = file.content
  if (file.truncated) {
    const res = await fetch({ url: file.raw_url, method: 'GET' })
    content = typeof res.body === 'string' ? res.body : JSON.stringify(res.body)
  }
  const data = JSON.parse(content || '{}')
  return Array.isArray(data.deletedWorkoutIds) ? data.deletedWorkoutIds : []
}

/** deletedWorkoutIds is echoed straight back, never modified here - only
 *  the phone ever adds to it (see the file header above). */
export async function pushWorkoutsToGist(gistId, token, workouts, customExercises, deletedWorkoutIds) {
  await request('PATCH', gistId, token, {
    files: {
      [GIST_FILE]: {
        // customExercises travels alongside the workouts that reference
        // them, so the phone can register any it doesn't already have
        // (by id) before importing - otherwise a workout logged against
        // a watch-only custom exercise would show up with a blank/unknown
        // exercise name once synced.
        content: JSON.stringify({ workouts, customExercises, deletedWorkoutIds }, null, 2),
      },
    },
  })
}
