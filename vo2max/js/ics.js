/*
 * Turns a logged session into a downloadable .ics file (RFC 5545), so it can
 * be added to Apple Calendar, Google Calendar, or Outlook without an
 * account or backend — just a file the OS already knows how to import.
 */

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

function descriptionText(session) {
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
  if (session.avgPace != null) lines.push(`Avg pace: ${session.avgPace} min/km`);
  if (session.distanceKm != null) lines.push(`Distance: ${session.distanceKm} km`);
  if (session.avgHR != null) lines.push(`Average HR: ${session.avgHR} bpm`);
  if (session.maxHR != null) lines.push(`Max HR: ${session.maxHR} bpm`);
  lines.push(`Session RPE: ${session.rpe}/10`);
  if (session.vo2max != null) lines.push(`VO2max reading: ${session.vo2max} ml/kg/min`);
  if (session.notes) lines.push(`Notes: ${session.notes}`);
  return lines.join('\n');
}

const typeLabel = { interval: '4x4', 'easy-run': 'Easy run', 'long-run': 'Long run' };

// Sessions logged before the type field existed have no `type` at all — treat as interval.
function typeOf(session) {
  return session.type ?? 'interval';
}

function summaryText(session) {
  const type = typeOf(session);
  if (hasLegacyIntervalData(session)) {
    const recovery = recoveryLabel[session.recovery] ?? session.recovery;
    return `VO2max: ${session.intervalsCompleted} interval${session.intervalsCompleted === 1 ? '' : 's'} (${recovery})`;
  }
  const duration = session.durationMin != null ? `${session.durationMin}min` : 'run';
  const distance = session.distanceKm != null ? `, ${session.distanceKm}km` : '';
  return `${typeLabel[type] ?? 'Run'}: ${duration}${distance}`;
}

export function sessionToICS(session) {
  const summary = summaryText(session);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VO2max Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${session.id}@vo2max-tracker`,
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
