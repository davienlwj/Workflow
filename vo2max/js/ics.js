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

function descriptionText(session) {
  const lines = [`Intervals completed: ${session.intervalsCompleted}`];
  const intervals = session.intervals || [];
  if (intervals.some((iv) => iv.avgHR != null || iv.peakHR != null)) {
    const perInterval = intervals
      .map((iv, i) => `R${i + 1} ${iv.avgHR ?? '—'}/${iv.peakHR ?? '—'}`)
      .join(', ');
    lines.push(`Per-interval HR (avg/peak): ${perInterval}`);
  }
  lines.push(`Recovery quality: ${recoveryLabel[session.recovery] ?? session.recovery}`);
  lines.push(`Session RPE: ${session.rpe}/10`);
  if (session.vo2max != null) lines.push(`VO2max reading: ${session.vo2max} ml/kg/min`);
  if (session.notes) lines.push(`Notes: ${session.notes}`);
  return lines.join('\n');
}

export function sessionToICS(session) {
  const recovery = recoveryLabel[session.recovery] ?? session.recovery;
  const summary = `VO2max: ${session.intervalsCompleted} interval${session.intervalsCompleted === 1 ? '' : 's'} (${recovery})`;

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
