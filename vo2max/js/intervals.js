/*
 * Client-only intervals.icu integration for automatic run import (bridging
 * a Zepp-paired watch, which has no public API of its own). Unlike Strava,
 * intervals.icu needs no OAuth flow at all - it's a personal API key the
 * user generates themselves from their own account settings and pastes in
 * here, so this needs no backend, no proxy, and no secret to protect.
 *
 * The actual chain from watch to app is: Zepp's own free auto-sync to
 * Strava (enabled in the Zepp app) -> intervals.icu's own free connection
 * to that Strava account (enabled on intervals.icu) -> this app reading
 * intervals.icu's API with the user's personal key. intervals.icu carries
 * its own commercial arrangement with Strava's API, so the per-athlete
 * Strava API subscription Strava now charges developers never applies to
 * an individual user going through intervals.icu.
 *
 * Read-only and one-way: activities are never modified on intervals.icu's
 * side, only pulled into local sessions. Only run-type activities are
 * imported - like Strava, intervals.icu has no equivalent to this app's
 * per-exercise, per-set strength data, so lift workouts still need to be
 * logged by hand.
 */

const API_BASE = 'https://intervals.icu/api/v1';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

// intervals.icu's documented auth scheme: a literal "ApiKey" prefix, then
// the literal string "API_KEY" as if it were a username, colon-separated
// from the athlete's actual key - not base64, not Bearer.
function authHeader(apiKey) {
  return `ApiKey API_KEY:${apiKey}`;
}

/** Every activity on/after `oldestIso` (a YYYY-MM-DD date - intervals.icu's
 *  `oldest` param takes a date, not a unix timestamp), most recent first.
 *  Throws on an invalid Athlete ID/API Key (401/403/404) so callers can
 *  surface that immediately when the user hits Connect. */
export async function listActivities(athleteId, apiKey, oldestIso) {
  const params = new URLSearchParams({ oldest: oldestIso });
  const url = `${API_BASE}/athlete/${encodeURIComponent(athleteId)}/activities?${params}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader(apiKey) } });
  } catch (err) {
    // fetch() throws (rather than resolving with a non-ok response) when no
    // response came back at all - offline, or the browser refused to even
    // send/read the request because the server didn't answer the CORS
    // preflight with permission for this origin. Tagged distinctly so the
    // UI can tell "wrong credentials" apart from "couldn't reach the API"
    // instead of collapsing both into one unhelpful message.
    const netErr = new Error(`Network request to intervals.icu failed: ${err.message}`);
    netErr.networkError = true;
    throw netErr;
  }
  if (!res.ok) {
    const err = new Error(`intervals.icu API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function isRunActivity(activity) {
  return RUN_TYPES.has(activity.type);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Maps an intervals.icu run activity to this app's session shape (see
 *  readSessionForm in app.js for what a manually-logged run looks like).
 *  Only distance/duration/pace/HR translate directly - RPE and session
 *  type (interval/easy/long) aren't things this data can tell us, so
 *  those get a neutral default the user can correct from the edit sheet. */
export function activityToSession(activity) {
  const distanceKm = activity.distance / 1000;
  const durationMin = activity.moving_time / 60;
  return {
    type: 'easy-run',
    date: (activity.start_date_local || activity.start_date).slice(0, 10),
    durationMin: Math.round(durationMin),
    avgPace: distanceKm > 0 ? durationMin / distanceKm : null,
    distanceKm: round2(distanceKm),
    avgHR: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    maxHR: activity.max_heartrate != null ? Math.round(activity.max_heartrate) : null,
    rpe: 6,
    vo2max: null,
    notes: `Imported from intervals.icu: "${activity.name}"`,
    intervalsActivityId: activity.id,
  };
}
