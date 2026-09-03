/*
 * Turns a logged session into a downloadable .ics file (RFC 5545), so it can
 * be added to Apple Calendar, Google Calendar, or Outlook without an
 * account or backend — just a file the OS already knows how to import. Also
 * builds the same summary/description text as Google Calendar event
 * resources for the automatic sync path (see gcal.js) - one set of "what
 * does this session/workout look like as a calendar event" logic shared by
 * both the manual .ics export and the automatic Google sync.
 */

import { formatPaceMinKm } from './block.js';
import { workoutSummaryByExercise, workoutVolume } from './workout.js';

const recoveryLabel = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

function pad(n) {
  return String(n).padStart(2, '0');
}

function escapeText(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 requires lines folded at 75 octets, continued with a leading space.
function foldLine(line) {
  const max = 75;
  if (line.length <= max) return line;
  let out = line.slice(0, max);
  let rest = line.slice(max);
  while (rest.length > 0) {
    out += `\r\n ${rest.slice(0, max - 1)}`;
    rest = rest.slice(max - 1);
  }
  return out;
}

function dtstampUTC(date = new Date()) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T`
    + `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function dateOnly(iso) {
  return iso.replaceAll('-', '');
}

function nextDateOnly(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// True for sessions logged before every type shared the same fields, back
// when "Interval (Norwegian 4x4)" had its own per-rep HR breakdown.
function hasLegacyIntervalData(session) {
  return Boolean(session.intervalsCompleted) || Boolean((session.intervals || []).length);
}

export function descriptionText(session) {
  const lines = [];
  if (hasLegacyIntervalData(session)) {
    lines.push(`Intervals completed: ${session.intervalsCompleted}`);
    const intervals = session.intervals || [];
    if (intervals.some((iv) => iv.avgHR != null || iv.peakHR != null || iv.durationMin != null)) {
      const perInterval = intervals
        .map((iv, i) => {
          const duration = iv.durationMin != null ? ` (${iv.durationMin}min)` : '';
          return `S${i + 1} ${iv.avgHR ?? '—'}/${iv.peakHR ?? '—'}${duration}`;
        })
        .join(', ');
      lines.push(`Per-interval HR (avg/peak): ${perInterval}`);
    }
    if (session.recovery) lines.push(`Recovery quality: ${recoveryLabel[session.recovery] ?? session.recovery}`);
  }
  if (session.durationMin != null) lines.push(`Duration: ${session.durationMin} min`);
  if (session.avgPace != null) lines.push(`Avg pace: ${formatPaceMinKm(session.avgPace)} min/km`);
  if (session.avgSpeedKmh != null) lines.push(`Avg speed: ${session.avgSpeedKmh} km/h`);
  if (session.avgPace100m != null) lines.push(`Avg pace: ${formatPaceMinKm(session.avgPace100m)} min/100m`);
  if (session.avgPace500m != null) lines.push(`Avg pace: ${formatPaceMinKm(session.avgPace500m)} min/500m`);
  if (session.avgRpm != null) lines.push(`Avg cadence: ${session.avgRpm} rpm`);
  if (session.avgStrokeRate != null) lines.push(`Stroke rate: ${session.avgStrokeRate} spm`);
  if (session.avgPower != null) lines.push(`Avg power: ${session.avgPower} W`);
  if (session.floorsClimbed != null) lines.push(`Floors climbed: ${session.floorsClimbed}`);
  if (session.stepRate != null) lines.push(`Step rate: ${session.stepRate} steps/min`);
  if (session.level != null) lines.push(`Level: ${session.level}`);
  if (session.resistanceLevel != null) lines.push(`Resistance level: ${session.resistanceLevel}`);
  if (session.incline != null) lines.push(`Incline: ${session.incline}%`);
  if (session.strideRate != null) lines.push(`Stride rate: ${session.strideRate} spm`);
  if (session.distanceKm != null) lines.push(`Distance: ${session.distanceKm} km`);
  if (session.avgHR != null) lines.push(`Average HR: ${session.avgHR} bpm`);
  if (session.maxHR != null) lines.push(`Max HR: ${session.maxHR} bpm`);
  lines.push(`Session RPE: ${session.rpe}/10`);
  if (session.vo2max != null) lines.push(`VO2max reading: ${session.vo2max} ml/kg/min`);
  if (session.notes) lines.push(`Notes: ${session.notes}`);
  return lines.join('\n');
}

// interval/easy-run/long-run are legacy keys (every run's type before the
// Easy/Long/Threshold/VO2max split existed) - kept mapped rather than
// migrated so old sessions keep displaying correctly. Mirrors app.js's own
// typeLabel/ACTIVITY_LABEL/sessionBadgeLabel (kept as a local duplicate,
// same as this file's other small label maps, so ics.js stays importable
// standalone without a circular dependency on app.js).
const typeLabel = {
  interval: 'VO2max', 'easy-run': 'Easy', 'long-run': 'Long',
  easy: 'Easy', long: 'Long', threshold: 'Threshold', vo2max: 'VO2max',
};
const activityLabel = {
  run: 'Run', ride: 'Cycling', stairmaster: 'Stairmaster', elliptical: 'Elliptical',
  row: 'RowErg', ski: 'SkiErg', swim: 'Swim', other: 'Activity',
};

/** A run's own Easy/Long/Threshold/VO2max sub-classification, or another
 *  sport's Activity label (Cycling, RowErg, ...) - preferring a legacy
 *  synced session's specific stored `type` string over the generic
 *  Activity label when both exist. */
function badgeLabel(session) {
  const sport = session.sport ?? 'run';
  if (sport === 'run') {
    const t = session.type ?? 'interval';
    return typeLabel[t] ?? t;
  }
  return session.type || activityLabel[sport] || 'Activity';
}

export function summaryText(session) {
  if (hasLegacyIntervalData(session)) {
    const recovery = recoveryLabel[session.recovery] ?? session.recovery;
    return `VO2max: ${session.intervalsCompleted} interval${session.intervalsCompleted === 1 ? '' : 's'} (${recovery})`;
  }
  const duration = session.durationMin != null ? `${session.durationMin}min` : 'run';
  const distance = session.distanceKm != null ? `, ${session.distanceKm}km` : '';
  return `${badgeLabel(session)}: ${duration}${distance}`;
}

export function sessionToICS(session) {
  const summary = summaryText(session);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VO2max Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${session.id}@hybrd-app-tracker`,
    `DTSTAMP:${dtstampUTC()}`,
    `DTSTART;VALUE=DATE:${dateOnly(session.date)}`,
    `DTEND;VALUE=DATE:${nextDateOnly(session.date)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(descriptionText(session))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function nextIsoDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

/** A logged session as a Google Calendar event resource (all-day, since
 *  sessions only carry a date - see gcal.js's upsertEvent). */
export function sessionToGCalEvent(session) {
  return {
    summary: summaryText(session),
    description: descriptionText(session),
    start: { date: session.date },
    end: { date: nextIsoDate(session.date) },
  };
}

function workoutSummaryText(workout, exercises, bodyweightKg) {
  const exCount = (workout.exercises || []).length;
  const volume = workoutVolume(workout, exercises, bodyweightKg);
  const label = workout.name || `Workout (${exCount} exercise${exCount === 1 ? '' : 's'})`;
  return `${label}, ${volume}kg volume`;
}

function workoutDescriptionText(workout, exercises, bodyweightKg) {
  const rows = workoutSummaryByExercise(workout, exercises, bodyweightKg);
  const lines = rows.map((r) => `${r.name}: ${r.setCount} set${r.setCount === 1 ? '' : 's'}, ${r.totalReps} reps, ${r.volume}kg volume`);
  if (workout.notes) lines.push(`Notes: ${workout.notes}`);
  return lines.length ? lines.join('\n') : 'No working sets logged.';
}

/** A logged workout as a Google Calendar event resource (all-day). `exercises`
 *  should include the user's custom exercises alongside the built-in
 *  library (see allExercises() in app.js) so names resolve for those too. */
export function workoutToGCalEvent(workout, exercises, bodyweightKg) {
  return {
    summary: workoutSummaryText(workout, exercises, bodyweightKg),
    description: workoutDescriptionText(workout, exercises, bodyweightKg),
    start: { date: workout.date },
    end: { date: nextIsoDate(workout.date) },
  };
}
