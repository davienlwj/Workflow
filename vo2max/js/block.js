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
 * in order as sessions are logged (oldest first).
 */
export function sessionChecklist(settings, sessions) {
  const total = totalPlannedSessions(settings);
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  return Array.from({ length: total }, (_, i) => {
    const done = sorted[i];
    const week = Math.floor(i / settings.protocol.freqPerWeek) + 1;
    return {
      index: i + 1,
      week,
      done: Boolean(done),
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
