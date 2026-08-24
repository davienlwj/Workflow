/*
 * Client-only Strava integration for automatic run import (via Zepp's
 * built-in Strava auto-sync, enabled from within the Zepp app itself).
 * Unlike Google's Identity Services, Strava's OAuth has no browser-safe
 * public-client flow - exchanging an authorization code (or refreshing a
 * token) requires a client_secret, which can never ship to the browser. So
 * those two calls go through a small proxy the user deploys themselves
 * (see strava-proxy/); everything else - the initial authorize redirect,
 * and reading activities with a valid access token - talks to Strava
 * directly from here.
 *
 * Read-only and one-way: activities are never modified on Strava's side,
 * only pulled into local sessions. Only run-type activities are imported -
 * Strava's data model has no equivalent to this app's per-exercise,
 * per-set strength data, so lift workouts still have to be logged by hand.
 */

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const API_BASE = 'https://www.strava.com/api/v3';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const STATE_KEY = 'vo2max.stravaOAuthState';

function redirectUri() {
  return `${location.origin}${location.pathname}`;
}

/** Kicks off the interactive connect flow by navigating the whole page to
 *  Strava's consent screen - Strava's OAuth has no popup/token-client
 *  equivalent to Google's GIS, so a full-page redirect (with the app
 *  reloading once Strava sends the user back) is the standard flow here. */
export function beginAuthorize(clientId) {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  location.href = `${AUTHORIZE_URL}?${params}`;
}

/** Reads `code`/`state`/`error` off the current URL if this page load is
 *  Strava sending the user back from the consent screen, and strips them
 *  back out of the address bar either way (so a later reload doesn't
 *  re-trigger anything). Returns the authorization code, or null if this
 *  load isn't a Strava redirect or the CSRF state didn't match. */
export function consumeAuthorizeRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  if (!code && !error) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  params.delete('code');
  params.delete('state');
  params.delete('scope');
  params.delete('error');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''));

  if (error || !code || !expectedState || state !== expectedState) return null;
  return code;
}

async function proxyPost(proxyUrl, path, body) {
  const res = await fetch(`${proxyUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.errors) {
    throw new Error(data?.message || `Strava proxy error ${res.status}`);
  }
  return data;
}

/** Exchanges an authorization code for tokens via the user's proxy. */
export async function exchangeCode(proxyUrl, code) {
  return proxyPost(proxyUrl, '/exchange', { code });
}

/** Refreshes an access token via the user's proxy. */
export async function refreshAccessToken(proxyUrl, refreshToken) {
  return proxyPost(proxyUrl, '/refresh', { refresh_token: refreshToken });
}

/** Every activity after `afterUnixSeconds` (or all of them if omitted),
 *  paginated 100 at a time - Strava's default page size is 30, so asking
 *  for the max keeps even a multi-year backfill to a handful of requests. */
export async function listActivities(accessToken, afterUnixSeconds) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const params = new URLSearchParams({ per_page: '100', page: String(page) });
    if (afterUnixSeconds) params.set('after', String(afterUnixSeconds));
    const res = await fetch(`${API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Strava API error ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export function isRunActivity(activity) {
  return RUN_TYPES.has(activity.sport_type || activity.type);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Maps a Strava run activity to this app's session shape (see
 *  readSessionForm in app.js for what a manually-logged run looks like).
 *  Only distance/duration/pace/HR translate directly - RPE and session
 *  type (interval/easy/long) aren't things Strava's data can tell us, so
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
    notes: `Imported from Strava: "${activity.name}"`,
    stravaActivityId: activity.id,
  };
}
