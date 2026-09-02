/*
 * Trimmed port of ../vo2max/js/intervals.js for the watch's side service -
 * same read-only, no-backend, personal-API-key integration, cut down to
 * just what the watch shows: latest wellness (VO2max, resting HR, sleep)
 * and enough recent activity history to say how long since the last run
 * and how far this week. See vo2max/README.md's "intervals.icu sync"
 * section for how the key/athlete ID are obtained.
 */

const API_BASE = 'https://intervals.icu/api/v1'
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun'])

function authHeader(apiKey) {
  return `Basic ${btoa(`API_KEY:${apiKey}`)}`
}

async function apiGet(path, apiKey) {
  const res = await fetch({
    url: `${API_BASE}${path}`,
    method: 'GET',
    headers: { Authorization: authHeader(apiKey) },
  })
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`intervals.icu API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body
}

/** Latest resting HR, sleep and VO2max from the last `lookbackDays` of the
 *  daily wellness log - a watch doesn't always sync same-day, so this looks
 *  back a week by default rather than only checking today. */
export async function fetchLatestWellness(athleteId, apiKey, lookbackDays = 7) {
  const newest = new Date()
  const oldest = new Date()
  oldest.setDate(oldest.getDate() - lookbackDays)
  const params = `oldest=${oldest.toISOString().slice(0, 10)}&newest=${newest.toISOString().slice(0, 10)}`
  const entries = await apiGet(`/athlete/${encodeURIComponent(athleteId)}/wellness?${params}`, apiKey)
  const sorted = [...(entries || [])].sort((a, b) => (b.id || '').localeCompare(a.id || ''))

  const restingHR = sorted.find((e) => e.restingHR != null)?.restingHR ?? null
  const sleepSecs = sorted.find((e) => e.sleepSecs != null)?.sleepSecs ?? null
  const vo2max = sorted.find((e) => e.vo2max != null)?.vo2max ?? null

  return {
    restingHR: restingHR != null ? Math.round(restingHR) : null,
    sleepHours: sleepSecs != null ? Math.round((sleepSecs / 3600) * 10) / 10 : null,
    vo2max: vo2max != null ? Math.round(vo2max * 10) / 10 : null,
  }
}

/** Days since the most recent run-type activity, and total km run so far
 *  this week (Monday-anchored) - both derived from the last 30 days of
 *  activity history so a quiet week still resolves "days since" correctly. */
export async function fetchRunStatus(athleteId, apiKey) {
  const oldest = new Date()
  oldest.setDate(oldest.getDate() - 30)
  const activities = await apiGet(
    `/athlete/${encodeURIComponent(athleteId)}/activities?oldest=${oldest.toISOString().slice(0, 10)}`,
    apiKey
  )
  const runs = (activities || [])
    .filter((a) => RUN_TYPES.has(a.type))
    .map((a) => ({
      date: (a.start_date_local || a.start_date).slice(0, 10),
      km: (a.distance || 0) / 1000,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  let daysSinceLastRun = null
  if (runs.length > 0) {
    const last = new Date(`${runs[0].date}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    daysSinceLastRun = Math.round((today - last) / 86400000)
  }

  const now = new Date()
  const monday = new Date(now)
  const dayIdx = (now.getDay() + 6) % 7 // 0 = Monday
  monday.setDate(now.getDate() - dayIdx)
  monday.setHours(0, 0, 0, 0)
  const weekKm = runs
    .filter((r) => new Date(`${r.date}T00:00:00`) >= monday)
    .reduce((sum, r) => sum + r.km, 0)

  return {
    daysSinceLastRun,
    weekKm: Math.round(weekKm * 10) / 10,
  }
}
