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
 *
 * Mostly read-only from this app's side, with one exception: deleting a
 * watch-originated workout here calls markWorkoutDeleted, which writes its
 * id to the Gist's deletedWorkoutIds list - the one thing this app ever
 * writes back - so the watch notices (see hybrd-watch/app-side/index.js)
 * and removes its own local copy on its next sync, rather than this app
 * re-importing the "deleted" workout right back in next time it checks.
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

async function apiPatch(path, token, body) {
  let res;
  try {
    res = await fetch(`${GITHUB_API}${path}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
 *  dedups), customExercises ({id, name} pairs added from the watch's own
 *  settings, which the caller should register locally by id before
 *  importing workouts that reference them - see registerWatchCustomExercises
 *  in app.js), and deletedWorkoutIds (watchWorkoutIds this app has already
 *  deleted - the caller should skip importing these). Handles the rare
 *  case a file's content comes back truncated (GitHub only inlines up to
 *  ~1MB) by re-fetching its raw_url. */
export async function fetchGistData(gistId, token) {
  const gist = await apiGet(`/gists/${encodeURIComponent(gistId)}`, token);
  const file = gist.files?.[GIST_FILE];
  if (!file) return { workouts: [], customExercises: [], deletedWorkoutIds: [] };
  let content = file.content;
  if (file.truncated) {
    const res = await fetch(file.raw_url);
    content = await res.text();
  }
  const data = JSON.parse(content || '{}');
  return {
    workouts: Array.isArray(data.workouts) ? data.workouts : [],
    customExercises: Array.isArray(data.customExercises) ? data.customExercises : [],
    deletedWorkoutIds: Array.isArray(data.deletedWorkoutIds) ? data.deletedWorkoutIds : [],
  };
}

/** Marks a watch-originated workout as deleted so the watch removes its
 *  own local copy on its next sync, instead of pushing it right back in.
 *  Read-modify-write against whatever's in the Gist right now - workouts
 *  and customExercises are echoed back unchanged, only deletedWorkoutIds
 *  gains this id. A concurrent write from the watch between the read and
 *  this write could in principle clobber each other, but in practice the
 *  watch only writes right after you finish a workout there, not on any
 *  regular schedule, so a collision is rare - and harmless if it happens,
 *  since the watch's next sync re-pushes its own full state anyway. */
export async function markWorkoutDeleted(gistId, token, watchWorkoutId) {
  const current = await fetchGistData(gistId, token);
  if (current.deletedWorkoutIds.includes(watchWorkoutId)) return;
  await apiPatch(`/gists/${encodeURIComponent(gistId)}`, token, {
    files: {
      [GIST_FILE]: {
        content: JSON.stringify(
          {
            workouts: current.workouts,
            customExercises: current.customExercises,
            deletedWorkoutIds: [...current.deletedWorkoutIds, watchWorkoutId],
          },
          null,
          2
        ),
      },
    },
  });
}
