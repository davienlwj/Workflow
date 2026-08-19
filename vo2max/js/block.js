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

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysSinceLastSession(sessions, now = todayIso()) {
  if (sessions.length === 0) return null;
  const last = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  return daysBetween(last.date, now);
}

export function averageIntervalHR(sessions) {
  const all = sessions.flatMap((s) => s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
  if (all.length === 0) return null;
  return Math.round(all.reduce((sum, v) => sum + v, 0) / all.length);
}

/** VO2max readings over time, baseline first, for the trend chart. */
export function vo2maxSeries(settings, sessions) {
  const points = [{ date: settings.baselineDate, value: settings.baselineVO2max, label: 'Baseline' }];
  sessions
    .filter((s) => s.vo2max != null)
    .forEach((s) => points.push({ date: s.date, value: s.vo2max, label: null }));
  return points.sort((a, b) => a.date.localeCompare(b.date));
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
