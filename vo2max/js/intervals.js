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
 * Read-only and one-way: nothing is ever modified on intervals.icu's side,
 * only pulled in. Every activity type imports - runs, rides, swims, walks,
 * hikes, and anything else intervals.icu reports - each classified into a
 * coarse "sport" bucket (see classifyActivity) that drives which unit a
 * session shows (pace for runs, speed for rides, pace/100m for swims, or
 * just duration/distance/HR for everything else). Note this app still has
 * no equivalent to per-exercise, per-set strength data, so a synced
 * WeightTraining activity comes in as a plain duration+HR session, not a
 * structured lift workout - those still need to be logged by hand. Daily
 * wellness data (resting HR, sleep) is also read-only, shown as Dashboard
 * stat tiles rather than stored as its own history.
 */

const API_BASE = 'https://intervals.icu/api/v1';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide']);
const SWIM_TYPES = new Set(['Swim', 'OpenWaterSwim']);

// Human-readable labels for activity types outside the run bucket (which
// keeps its own existing Interval/Easy run/Long run classification instead -
// see classifyActivity). Anything not listed here still imports fine: it
// just falls back to intervals.icu's own type string as the label.
const ACTIVITY_LABELS = {
  Ride: 'Ride',
  VirtualRide: 'Virtual ride',
  GravelRide: 'Gravel ride',
  MountainBikeRide: 'Mountain bike',
  EBikeRide: 'E-bike ride',
  EMountainBikeRide: 'E-mountain bike',
  Swim: 'Swim',
  OpenWaterSwim: 'Open water swim',
  Walk: 'Walk',
  Hike: 'Hike',
  Rowing: 'Rowing',
  Elliptical: 'Elliptical',
  WeightTraining: 'Weight training',
  Yoga: 'Yoga',
  Workout: 'Workout',
  AlpineSki: 'Alpine ski',
  NordicSki: 'Nordic ski',
  IceSkate: 'Ice skating',
  StairStepper: 'Stair stepper',
  Crossfit: 'Crossfit',
};

// intervals.icu uses standard HTTP Basic Auth with the literal string
// "API_KEY" as the username and the athlete's real key as the password -
// equivalent to `curl -u API_KEY:<key>`, base64-encoded per RFC 7617.
function authHeader(apiKey) {
  return `Basic ${btoa(`API_KEY:${apiKey}`)}`;
}

async function apiGet(path, apiKey) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: authHeader(apiKey) } });
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

/** Every activity on/after `oldestIso` (a YYYY-MM-DD date - intervals.icu's
 *  `oldest` param takes a date, not a unix timestamp), most recent first.
 *  Throws on an invalid Athlete ID/API Key (401/403/404) so callers can
 *  surface that immediately when the user hits Connect. */
export async function listActivities(athleteId, apiKey, oldestIso) {
  const params = new URLSearchParams({ oldest: oldestIso });
  return apiGet(`/athlete/${encodeURIComponent(athleteId)}/activities?${params}`, apiKey);
}

/** Coarse sport bucket + display type for an intervals.icu activity. `sport`
 *  drives which unit a session shows (run keeps this app's original
 *  Interval/Easy run/Long run classification and pace/km; ride gets speed
 *  km/h; swim gets pace/100m; everything else - walks, hikes, weight
 *  training, and any future activity type this app doesn't specifically
 *  know about - is 'other', imported with just duration/distance/HR and no
 *  derived pace/speed metric). `type` is what activityToSession stores as
 *  the session's own `type` field: the existing 'easy-run' enum key for
 *  runs (so the History list's Interval/Easy run/Long run labeling is
 *  untouched), or a plain display string for everything else, which the
 *  History badge already shows as-is via its `typeLabel[type] ?? type`
 *  fallback. */
export function classifyActivity(activity) {
  if (RUN_TYPES.has(activity.type)) return { sport: 'run', type: 'easy-run' };
  if (RIDE_TYPES.has(activity.type)) return { sport: 'ride', type: ACTIVITY_LABELS[activity.type] || 'Ride' };
  if (SWIM_TYPES.has(activity.type)) return { sport: 'swim', type: ACTIVITY_LABELS[activity.type] || 'Swim' };
  return { sport: 'other', type: ACTIVITY_LABELS[activity.type] || activity.type };
}

/** Resting HR and sleep from intervals.icu's daily wellness log, looking
 *  back up to `lookbackDays` (a week, by default) for whichever day most
 *  recently has each value - a watch doesn't always sync same-day, so
 *  this covers a small gap rather than only checking today. Each field
 *  falls back independently, and comes back null only when neither shows
 *  up anywhere in the window, so the caller can show that as an explicit
 *  "not tracked" remark instead of a bogus 0. */
export async function fetchRecentWellness(athleteId, apiKey, lookbackDays = 7) {
  const newest = new Date();
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - lookbackDays);
  const params = new URLSearchParams({
    oldest: oldest.toISOString().slice(0, 10),
    newest: newest.toISOString().slice(0, 10),
  });
  const entries = await apiGet(`/athlete/${encodeURIComponent(athleteId)}/wellness?${params}`, apiKey);
  const sorted = [...(entries || [])].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
  const restingHR = sorted.find((e) => e.restingHR != null)?.restingHR ?? null;
  const sleepSecs = sorted.find((e) => e.sleepSecs != null)?.sleepSecs ?? null;

  return {
    restingHR: restingHR != null ? Math.round(restingHR) : null,
    sleepHours: sleepSecs != null ? Math.round((sleepSecs / 3600) * 10) / 10 : null,
  };
}

/** Every day's resting HR, sleep and VO2max estimate in the given range
 *  (oldest/newest as YYYY-MM-DD), oldest first - the full history behind
 *  the Dashboard tiles' single latest-known values (for their tap-through
 *  detail charts), and behind auto-filling a newly-imported run's VO2max
 *  from the watch's own daily estimate instead of leaving it for the user
 *  to type in by hand. */
export async function fetchWellnessHistory(athleteId, apiKey, oldestIso, newestIso) {
  const params = new URLSearchParams({ oldest: oldestIso, newest: newestIso });
  const entries = await apiGet(`/athlete/${encodeURIComponent(athleteId)}/wellness?${params}`, apiKey);
  return (entries || [])
    .filter((e) => e.id)
    .map((e) => ({
      date: e.id,
      restingHR: e.restingHR != null ? Math.round(e.restingHR) : null,
      sleepHours: e.sleepSecs != null ? Math.round((e.sleepSecs / 3600) * 10) / 10 : null,
      vo2max: e.vo2max != null ? Math.round(e.vo2max * 10) / 10 : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** One elapsed-seconds/heart-rate/pace point per recorded sample of a run,
 *  for the per-activity charts (HR-over-time, pace-over-time, and the time-
 *  in-zone bars computed locally from these HR samples). Pace prefers the
 *  velocity_smooth stream (m/s -> min/km); if that's missing it's derived
 *  from consecutive distance/time deltas instead. Returns an empty array
 *  (not an error) when the activity has no recorded streams at all - e.g. a
 *  manually-entered activity with only summary stats, no GPS/HR trace. */
export async function fetchActivityStreams(activityId, apiKey) {
  const params = new URLSearchParams({ types: 'time,heartrate,velocity_smooth,distance' });
  const raw = await apiGet(`/activity/${encodeURIComponent(activityId)}/streams.json?${params}`, apiKey);
  const byType = {};
  for (const stream of raw || []) {
    if (Array.isArray(stream?.data)) byType[stream.type] = stream.data;
  }
  const time = byType.time;
  if (!Array.isArray(time) || time.length === 0) return [];
  const hr = byType.heartrate;
  const velocity = byType.velocity_smooth;
  const distance = byType.distance;

  const points = [];
  for (let i = 0; i < time.length; i++) {
    const t = time[i];
    let paceMinKm = null;
    if (Array.isArray(velocity) && velocity[i] > 0) {
      paceMinKm = 1000 / (velocity[i] * 60);
    } else if (Array.isArray(distance) && i > 0 && distance[i] > distance[i - 1] && t > time[i - 1]) {
      const dKm = (distance[i] - distance[i - 1]) / 1000;
      const dMin = (t - time[i - 1]) / 60;
      paceMinKm = dKm > 0 ? dMin / dKm : null;
    }
    points.push({
      t,
      hr: Array.isArray(hr) && hr[i] != null ? Math.round(hr[i]) : null,
      paceMinKm: paceMinKm != null && Number.isFinite(paceMinKm) ? round2(paceMinKm) : null,
    });
  }
  return points;
}

/** Maps an intervals.icu activity of any sport to this app's session shape
 *  (see readSessionForm in app.js for what a manually-logged run looks
 *  like). Distance/duration/HR translate directly for every sport; the
 *  pace-like metric is sport-specific (see classifyActivity) - avgPace
 *  (min/km) for a run, avgSpeedKmh for a ride, avgPace100m for a swim, and
 *  no metric at all for 'other'. RPE and (for runs) the Interval/Easy/Long
 *  sub-classification aren't things this data can tell us, so those get a
 *  neutral default the user can correct from the edit sheet. */
export function activityToSession(activity) {
  const { sport, type } = classifyActivity(activity);
  const distanceKmRaw = activity.distance != null ? activity.distance / 1000 : null;
  const durationMin = activity.moving_time / 60;
  const session = {
    sport,
    type,
    date: (activity.start_date_local || activity.start_date).slice(0, 10),
    durationMin: Math.round(durationMin),
    distanceKm: distanceKmRaw != null ? round2(distanceKmRaw) : null,
    avgHR: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    maxHR: activity.max_heartrate != null ? Math.round(activity.max_heartrate) : null,
    rpe: 6,
    vo2max: null,
    notes: `Imported from intervals.icu: "${activity.name}"`,
    intervalsActivityId: activity.id,
  };
  if (sport === 'run') {
    session.avgPace = distanceKmRaw != null && distanceKmRaw > 0 ? durationMin / distanceKmRaw : null;
  } else if (sport === 'ride') {
    session.avgSpeedKmh = distanceKmRaw != null && durationMin > 0 ? round2((distanceKmRaw / durationMin) * 60) : null;
  } else if (sport === 'swim') {
    session.avgPace100m = distanceKmRaw != null && distanceKmRaw > 0 ? round2(durationMin / (distanceKmRaw * 10)) : null;
  }
  return session;
}
