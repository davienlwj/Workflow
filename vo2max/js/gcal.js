/*
 * Client-only Google Calendar sync. No backend exists (this is a static
 * PWA), so the browser talks to the Calendar API directly using a
 * short-lived OAuth access token from Google Identity Services (GIS) - the
 * user brings their own OAuth Client ID (created once in their own Google
 * Cloud project; see README) and pastes it into Settings.
 *
 * Scoped to calendar.app.created, the narrowest scope Google offers: the
 * app can only ever see/edit/delete calendars *it* created, never the
 * user's existing calendars or events. On first connect it creates one
 * dedicated "HYBR. Workouts" calendar and syncs every run/workout into
 * that, going forward automatically on every save.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
export const CALENDAR_NAME = 'HYBR. Workouts';
const API_BASE = 'https://www.googleapis.com/calendar/v3';

let gisLoadPromise = null;
let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// One token client per Client ID - re-init if the user pastes a different one.
function ensureTokenClient(clientId) {
  if (tokenClient && tokenClient.__clientId === clientId) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: CALENDAR_SCOPE,
    callback: () => {}, // replaced per-request in requestToken
  });
  tokenClient.__clientId = clientId;
  return tokenClient;
}

/** True while an access token is cached in memory and not yet expired.
 *  Tokens are never persisted to storage (they're short-lived, ~1h, and
 *  holding one only in memory means a fresh page load always starts
 *  "disconnected" until the next sync silently (or the user explicitly)
 *  reconnects - a deliberately conservative default for a token with
 *  calendar-write access). */
export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < tokenExpiresAt;
}

export function clearToken() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
}

async function requestToken(clientId, interactive) {
  await loadGis();
  const client = ensureTokenClient(clientId);
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      // Trim 30s off the stated lifetime so a sync in flight never races the
      // token's real expiry.
      tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 30000;
      resolve(accessToken);
    };
    client.error_callback = (err) => reject(new Error(err?.type || 'gis_error'));
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

/** Interactive connect flow - only call this from a user gesture (a click
 *  handler), since it can pop up Google's consent screen. */
export async function connect(clientId) {
  return requestToken(clientId, true);
}

/** Best-effort silent token (re)fetch for the automatic sync-on-save path.
 *  Resolves to null instead of throwing when silent reauth isn't possible
 *  right now (e.g. the browser needs an interactive prompt again) - callers
 *  should treat that as "sync skipped for now, will retry on the next
 *  save or when the user reconnects from Settings". */
export async function silentToken(clientId) {
  if (hasValidToken()) return accessToken;
  try {
    return await requestToken(clientId, false);
  } catch {
    return null;
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Calendar API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Finds the app's dedicated calendar, creating it the first time. `knownId`
 *  (settings.googleCalendar.calendarId) is reused as-is without a lookup,
 *  unless it turns out to have been deleted from the Google side (404), in
 *  which case a fresh one is created - callers should re-cache whatever id
 *  comes back, since it may differ from `knownId`. */
export async function getOrCreateCalendar(token, knownId) {
  if (knownId) {
    try {
      await api(`/calendars/${encodeURIComponent(knownId)}`, { token });
      return knownId;
    } catch (err) {
      if (err.status !== 404) throw err;
      // Deleted on the Google side since we last cached it - recreate below.
    }
  }
  const created = await api('/calendars', { method: 'POST', token, body: { summary: CALENDAR_NAME } });
  return created.id;
}

/** Creates the event when `eventId` is null/undefined, otherwise updates it
 *  in place. Returns the event's id (unchanged from `eventId` on update). */
export async function upsertEvent(token, calendarId, eventId, event) {
  const path = eventId
    ? `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    : `/calendars/${encodeURIComponent(calendarId)}/events`;
  const result = await api(path, { method: eventId ? 'PATCH' : 'POST', token, body: event });
  return result.id;
}

export async function deleteEvent(token, calendarId, eventId) {
  try {
    await api(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', token });
  } catch (err) {
    // Already gone (removed directly in Google Calendar, or the calendar
    // itself was deleted) - nothing left to clean up either way.
    if (err.status !== 404 && err.status !== 410) throw err;
  }
}
