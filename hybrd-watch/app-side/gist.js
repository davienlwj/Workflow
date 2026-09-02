/*
 * Pushes locally-logged workouts to a GitHub Gist so the phone app can pick
 * them up - same "personal token, no backend" shape as the intervals.icu
 * bridge, since the watch's side-service and the phone browser's
 * localStorage are otherwise two sandboxes with no way to reach each other.
 * The watch always pushes its *full* local workout history (not just new
 * ones); the phone dedups on read by watchWorkoutId. See setting/index.js
 * and ../../vo2max/js/gistSync.js for the two ends of this.
 */

const GITHUB_API = 'https://api.github.com'
const GIST_FILE = 'hybrd-workouts.json'

export async function pushWorkoutsToGist(gistId, token, workouts, customExercises) {
  const res = await fetch({
    url: `${GITHUB_API}/gists/${gistId}`,
    method: 'PATCH',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'hybrd-watch', // GitHub's API rejects requests with no User-Agent
    },
    body: JSON.stringify({
      files: {
        [GIST_FILE]: {
          // customExercises travels alongside the workouts that reference
          // them, so the phone can register any it doesn't already have
          // (by id) before importing - otherwise a workout logged against
          // a watch-only custom exercise would show up with a blank/unknown
          // exercise name once synced.
          content: JSON.stringify({ workouts, customExercises }, null, 2),
        },
      },
    }),
  })
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`GitHub Gist API error ${res.status}`)
    err.status = res.status
    throw err
  }
}
