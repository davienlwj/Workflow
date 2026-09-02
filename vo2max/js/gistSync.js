/*
 * Client-only GitHub Gist integration for pulling workouts logged on the
 * Amazfit T-Rex 3 Pro companion app (see ../../hybrd-watch/) into this
 * app's workout history. Same shape as intervals.js's bridge: a personal
 * access token you generate yourself, no backend, no OAuth. The watch's
 * side-service and this browser's localStorage are otherwise two
 * unreachable sandboxes - the Gist is the shared drop point between them.
 *
 * The watch always pushes its *full* local workout history to the Gist
 * (not just new entries) on every save; this module dedups on read by
 * watchWorkoutId, so importing the same Gist repeatedly is harmless.
 * Read-only from this app's side too: nothing is ever written back to the
 * Gist here, only read.
 */

const GITHUB_API = 'https://api.github.com';
const GIST_FILE = 'hybrd-workouts.json';

async function apiGet(path, token) {
  let res;
  try {
    res = await fetch(`${GITHUB_API}${path}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    });
  } catch (err) {
    const netErr = new Error(`Network request to GitHub failed: ${err.message}`);
    netErr.networkError = true;
    throw netErr;
  }
  if (!res.ok) {
    const err = new Error(`GitHub API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Everything currently sitting in the Gist: workouts (oldest sync state
 *  included - {watchWorkoutId, date, name, notes, exercises}, the caller
 *  dedups) and customExercises ({id, name} pairs added from the watch's
 *  own settings, which the caller should register locally by id before
 *  importing workouts that reference them - see registerWatchCustomExercises
 *  in app.js). Handles the rare case a file's content comes back truncated
 *  (GitHub only inlines up to ~1MB) by re-fetching its raw_url. */
export async function fetchGistData(gistId, token) {
  const gist = await apiGet(`/gists/${encodeURIComponent(gistId)}`, token);
  const file = gist.files?.[GIST_FILE];
  if (!file) return { workouts: [], customExercises: [] };
  let content = file.content;
  if (file.truncated) {
    const res = await fetch(file.raw_url);
    content = await res.text();
  }
  const data = JSON.parse(content || '{}');
  return {
    workouts: Array.isArray(data.workouts) ? data.workouts : [],
    customExercises: Array.isArray(data.customExercises) ? data.customExercises : [],
  };
}
