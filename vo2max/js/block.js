/*
 * Training-block math: which week the protocol is in, retest weeks, the
 * session checklist, and aggregate stats for the Progress view. Pure
 * functions of settings + sessions so they stay in sync as either changes.
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

/** 1-indexed current week of the block; clamped to [1, blockWeeks]. */
export function currentWeek(settings, now = todayIso()) {
  const elapsedDays = daysBetween(settings.protocolStartDate, now);
  const week = Math.floor(elapsedDays / 7) + 1;
  return Math.min(Math.max(week, 1), settings.protocol.blockWeeks);
}

/** Weeks (1-indexed) at which VO2max should be retested: block midpoint and end. */
export function retestWeeks(settings) {
  const total = settings.protocol.blockWeeks;
  const mid = Math.round(total / 2);
  return [...new Set([mid, total])].sort((a, b) => a - b);
}

export function totalPlannedSessions(settings) {
  return settings.protocol.freqPerWeek * settings.protocol.blockWeeks;
}

/**
 * Checklist of the whole block, one entry per planned session slot, filled
 * in order as sessions are logged (oldest first). Easy runs are logged
 * separately and don't count toward the interval block. A slot is
 * "overdue" if its week has fully elapsed and it's still unfilled — this
 * only flags whole missed weeks, since we track slots by week, not by an
 * exact planned day within the week.
 */
export function sessionChecklist(settings, sessions, now = todayIso()) {
  const total = totalPlannedSessions(settings);
  const week = currentWeek(settings, now);
  const sorted = sessions
    .filter((s) => (s.type ?? 'interval') === 'interval')
    .sort((a, b) => a.date.localeCompare(b.date));
  return Array.from({ length: total }, (_, i) => {
    const done = sorted[i];
    const slotWeek = Math.floor(i / settings.protocol.freqPerWeek) + 1;
    return {
      index: i + 1,
      week: slotWeek,
      done: Boolean(done),
      overdue: !done && slotWeek < week,
      date: done ? done.date : null,
      sessionId: done ? done.id : null,
    };
  });
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
