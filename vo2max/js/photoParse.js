/*
 * Turns OCR text read off a workout-summary screenshot (tuned to the Zepp /
 * Amazfit "activity detail" card) into structured fields the Log form can
 * pre-fill. Pure text-in, object-out — no image or network code here, so
 * it's testable without a browser. See ocr.js for the OCR step itself.
 *
 * OCR output is noisy: on this card each stat is a big number with its
 * label on the next line below, so a label can just as easily read out
 * *before* its value as after, depending on how the OCR engine segments
 * the layout. Every lookup here searches a window on both sides of the
 * label and picks the closest match rather than assuming an order. Nothing
 * is guessed when no confident match exists — the caller always shows the
 * result for the user to check before saving, never auto-submits.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Finds `label` in `text`, then returns whichever match of `valuePattern`
 * sits closest to it. By default searches `window` chars on both sides
 * (for stat tiles, where OCR order between a value and its label is
 * unpredictable); pass `direction: 'forward'` for layouts where the value
 * is known to always follow the label (e.g. a repeated list of records),
 * so a neighbouring record's leftover value can't be mistaken for this
 * one's.
 */
function valueNearLabel(text, label, valuePattern, { window = 60, direction = 'both' } = {}) {
  const idx = text.toLowerCase().indexOf(label.toLowerCase());
  if (idx === -1) return null;
  const start = direction === 'forward' ? idx : Math.max(0, idx - window);
  const near = text.slice(start, idx + label.length + window);
  const labelStart = idx - start;
  const labelEnd = labelStart + label.length;

  const flags = valuePattern.flags.includes('g') ? valuePattern.flags : `${valuePattern.flags}g`;
  const re = new RegExp(valuePattern.source, flags);
  let best = null;
  let bestDist = Infinity;
  let m = re.exec(near);
  while (m) {
    if (direction === 'forward' && m.index < labelEnd) {
      m = re.exec(near);
      continue;
    }
    const dist = Math.min(Math.abs(m.index - labelEnd), Math.abs(m.index + m[0].length - labelStart));
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
    m = re.exec(near);
  }
  return best;
}

function intNear(text, label) {
  const m = valueNearLabel(text, label, /(\d{1,4})/);
  return m ? Number(m[1]) : null;
}

function paceNear(text, label) {
  const m = valueNearLabel(text, label, /(\d{1,2})\D{1,2}(\d{2})/);
  return m ? `${m[1]}'${m[2]}"/km` : null;
}

function parseDate(text, now = new Date()) {
  const m = /(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})/i.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const monthIdx = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (monthIdx === -1) return null;
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  const candidate = new Date(year, monthIdx, day);
  // No year on the screenshot means "most recent occurrence" — if that
  // lands in the future (e.g. parsing a December photo in January), it
  // must actually have been last year.
  if (!m[3] && candidate.getTime() - now.getTime() > 7 * 86400000) {
    year -= 1;
  }
  return `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
}

/** "25:04" or "1:05:04" style duration -> minutes, rounded to 1 decimal. */
function parseDurationMin(text) {
  const m = valueNearLabel(text, 'workout time', /(\d{1,2}:\d{2}(?::\d{1,2})?)/);
  if (!m) return null;
  const parts = m[1].split(':').map(Number);
  const [h, mi, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return Math.round((h * 60 + mi + s / 60) * 10) / 10;
}

function parseDistanceKm(text) {
  const m = /(\d+(?:\.\d+)?)\s*km/i.exec(text);
  return m ? Number(m[1]) : null;
}

/** The "158 Avg / 176 Max" heart-rate pairing, scoped to the HR detail section. */
function parseHR(text) {
  const anchor = text.toLowerCase().indexOf('(bpm)');
  const section = anchor === -1 ? text : text.slice(anchor, anchor + 150);
  const avg = valueNearLabel(section, 'avg', /(\d{2,3})/, { window: 40 });
  const max = valueNearLabel(section, 'max', /(\d{2,3})/, { window: 40 });
  if (avg || max) return { avgHR: avg ? Number(avg[1]) : null, maxHR: max ? Number(max[1]) : null };
  // Fall back to the top-line stat tile if the detail section wasn't found.
  const fallback = intNear(text, 'avg heart rate');
  return { avgHR: fallback, maxHR: null };
}

const ZONE_NAMES = ['Anaerobic endurance', 'Lactate threshold', 'Aerobic endurance', 'Efficient Fat Burning', 'Active Recovery'];

function parseZones(text) {
  const zones = [];
  for (const name of ZONE_NAMES) {
    // Forward-only: each zone's own bpm range/%/time always follows its name
    // in the list, and a bidirectional search would sometimes land on the
    // previous zone's trailing values instead, which sit closer by distance.
    const pct = valueNearLabel(text, name, /(\d{1,3})%/, { window: 45, direction: 'forward' });
    const time = valueNearLabel(text, name, /(\d{1,2}:\d{2})/, { window: 45, direction: 'forward' });
    if (pct || time) {
      zones.push({ name, pct: pct ? Number(pct[1]) : null, time: time ? time[1] : null });
    }
  }
  return zones;
}

export function parseWorkoutText(text, { now = new Date() } = {}) {
  const { avgHR, maxHR } = parseHR(text);
  return {
    date: parseDate(text, now),
    durationMin: parseDurationMin(text),
    distanceKm: parseDistanceKm(text),
    avgHR,
    maxHR,
    calories: intNear(text, 'calories'),
    trainingLoad: intNear(text, 'training load'),
    avgPace: paceNear(text, 'avg pace'),
    bestPace: paceNear(text, 'best pace'),
    zones: parseZones(text),
  };
}

/** Everything parsed that doesn't have a dedicated form field, as lines for Notes. */
export function summarizeForNotes(parsed) {
  const parts = [];
  if (parsed.avgPace || parsed.bestPace) {
    const bits = [];
    if (parsed.avgPace) bits.push(`avg ${parsed.avgPace}`);
    if (parsed.bestPace) bits.push(`best ${parsed.bestPace}`);
    parts.push(`Pace: ${bits.join(', ')}`);
  }
  if (parsed.calories != null) parts.push(`Calories: ${parsed.calories}`);
  if (parsed.trainingLoad != null) parts.push(`Training load: ${parsed.trainingLoad}`);
  if (parsed.zones.length > 0) {
    const zoneText = parsed.zones
      .map((z) => `${z.name} ${z.pct != null ? `${z.pct}%` : '—'}${z.time ? ` (${z.time})` : ''}`)
      .join(', ');
    parts.push(`HR zones: ${zoneText}`);
  }
  return parts.join('\n');
}
