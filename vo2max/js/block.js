/*
 * Aggregate stats for the Progress view — pure functions of settings +
 * sessions so they stay in sync as either changes.
 */

const DAY_MS = 86400000;

function toDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function daysBetween(fromIso, toIso) {
  return Math.round((toDate(toIso) - toDate(fromIso)) / DAY_MS);
}

/** Parses the pace field's "m:ss" text (e.g. "5:25") into decimal
 *  minutes/km - the unit avgPace has always been stored in. A bare number
 *  (with or without a decimal point) is also accepted as minutes, so an
 *  old value round-tripped through formatPaceMinKm - or just typed
 *  without a colon - still parses. Returns null for empty/unparseable input. */
export function parsePaceMinKm(v) {
  const s = (v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/** Decimal minutes/km -> "5:25" (m:ss) for display, or '' if null. */
export function formatPaceMinKm(decimalMinutes) {
  if (decimalMinutes == null) return '';
  const totalSeconds = Math.round(decimalMinutes * 60);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fmtDateLong(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Milliseconds -> "mm:ss", or "h:mm:ss" past an hour. */
export function fmtElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function daysSinceLastSession(sessions, now = todayIso()) {
  if (sessions.length === 0) return null;
  const last = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  return daysBetween(last.date, now);
}

/** Average HR pooled across every session that has one: the unified avgHR
 *  field, plus each per-interval avgHR reading on older interval sessions
 *  logged before all session types shared the same fields. */
export function averageSessionHR(sessions) {
  const direct = sessions.map((s) => s.avgHR).filter((v) => v != null);
  const legacy = sessions.flatMap((s) => s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
  const all = [...direct, ...legacy];
  if (all.length === 0) return null;
  return Math.round(all.reduce((sum, v) => sum + v, 0) / all.length);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Monday-start week containing `date` (a Date), at local midnight. */
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayIdx = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dayIdx);
  return d;
}

function fmtShortDate(d) {
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
}

/**
 * Distance (any session with a distanceKm, i.e. easy/long runs) bucketed by
 * week, month or year, for the mileage bar chart. Buckets run oldest to
 * newest and always include the current period even if it has no data yet.
 */
export function mileageBuckets(sessions, granularity, now = new Date()) {
  const runs = sessions.filter((s) => s.distanceKm != null);
  const kmInRange = (from, to) => round1(
    runs
      .filter((s) => { const d = toDate(s.date); return d >= from && d < to; })
      .reduce((sum, s) => sum + s.distanceKm, 0),
  );

  if (granularity === 'month') {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({ label: from.toLocaleDateString('en-GB', { month: 'short' }), km: kmInRange(from, to) });
    }
    return months;
  }

  if (granularity === 'year') {
    const years = [...new Set(runs.map((s) => s.date.slice(0, 4)))].sort();
    if (!years.includes(String(now.getFullYear()))) years.push(String(now.getFullYear()));
    years.sort();
    return years.map((y) => {
      const from = new Date(Number(y), 0, 1);
      const to = new Date(Number(y) + 1, 0, 1);
      return { label: y, km: kmInRange(from, to) };
    });
  }

  // week (default)
  const weeks = [];
  const thisWeekStart = startOfWeek(now);
  for (let i = 7; i >= 0; i--) {
    const from = new Date(thisWeekStart);
    from.setDate(from.getDate() - i * 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    weeks.push({ label: fmtShortDate(from), km: kmInRange(from, to) });
  }
  return weeks;
}

/** Total distance logged across all runs (easy + long), for a summary line. */
export function totalMileage(sessions) {
  return round1(sessions.filter((s) => s.distanceKm != null).reduce((sum, s) => sum + s.distanceKm, 0));
}
