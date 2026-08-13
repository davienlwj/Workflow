/*
 * Workflow - natural language task parser.
 *
 * Takes one line of everyday text and pulls out the key fields:
 *
 *   "meeting with Tom at KLCC at 3pm on 12/8"
 *     -> { title: "Meeting with Tom", date: "2026-08-12",
 *          time: "15:00", location: "KLCC", people: ["Tom"] }
 *
 * It works by finding the most specific things first (time, then date, then
 * location), masking each match out of the string as it goes, and treating
 * whatever survives as the subject.
 */

// Mask character. Non-word and non-whitespace, so a consumed span is a hard
// barrier for later patterns while every index stays stable.
const MASK = '\u0001';

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_WORDS = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

// Words that should never survive at the start or end of a subject line.
const EDGE_WORDS = new Set([
  'at', 'on', 'in', 'from', 'to', 'by', 'for', 'the', 'a', 'an', 'and', 'of',
  'is', 'was', 'this', 'that', 'my', 'me', 'i', 'be', 'it', 'then', 'til',
  'till', 'until', 'about', 'around', 'add', 'schedule', 'remind', 'set',
]);

// Words that close a location phrase: "at KLCC to discuss the budget".
const LOCATION_STOP = new Set([
  'to', 'and', 'for', 'with', 'about', 'regarding', 're', 'then', 'so',
  'because', 'before', 'after', 'from', 'until', 'till', 'but', 'on', 'at',
]);

// Said on its own ("dinner tonight"), a part of day is enough to place the
// task on the clock.
const PART_OF_DAY = { morning: 9, afternoon: 14, evening: 19, night: 20, tonight: 20 };

// Meal words only settle am vs pm for an hour the user did give: "dinner at 8"
// is 8pm, "breakfast at 8" is 8am. On their own they leave the time unset.
const MEAL_HINT = {
  breakfast: 8, brunch: 10, lunch: 12, tea: 16, dinner: 19, supper: 20, drinks: 19,
};

export const DEFAULTS = { dayFirst: true, weekStart: 1 };

/* ------------------------------------------------------------------ utils */

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** A cursor over the input that can mask out consumed spans. */
class Scanner {
  constructor(raw) {
    this.chars = [...raw];
  }

  get text() {
    return this.chars.join('');
  }

  consume(start, end) {
    for (let i = start; i < end && i < this.chars.length; i++) this.chars[i] = MASK;
  }

  /** Match a regex against the unconsumed text, then mask what it matched. */
  take(re) {
    const m = re.exec(this.text);
    if (!m) return null;
    this.consume(m.index, m.index + m[0].length);
    return m;
  }
}

/* ------------------------------------------------------------------- time */

/** Turn a written hour into a 24h hour, using am/pm or context as the guide. */
function to24h(hour, ap, hint) {
  const base = hour % 12;
  if (ap) return /p/i.test(ap) ? base + 12 : base;
  if (hint != null) return hint >= 12 && hour !== 12 ? base + 12 : base;
  if (hour === 12) return 12;
  if (hour >= 1 && hour <= 7) return base + 12; // "at 3" reads as 3pm
  return base;
}

function parseTime(scanner) {
  // A part of day, or failing that a meal, disambiguates a bare hour.
  const hintMatch = /\b(morning|afternoon|evening|tonight|night)\b/i.exec(scanner.text);
  const mealMatch = /\b(breakfast|brunch|lunch|dinner|supper|drinks|tea)\b/i.exec(scanner.text);
  const hint = hintMatch
    ? PART_OF_DAY[hintMatch[1].toLowerCase()]
    : (mealMatch ? MEAL_HINT[mealMatch[1].toLowerCase()] : null);

  // 1. Range with an explicit am/pm on the end: "3-5pm", "from 9.30 to 11am"
  const range = scanner.take(
    /\b(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i,
  );
  if (range) {
    const [, h1, m1, ap1, h2, m2, ap2] = range;
    const endH = to24h(+h2, ap2, hint);
    // "3-5pm" -> the start shares the end's half of the day when it fits.
    const startH = to24h(+h1, ap1 || (endH >= 12 && +h1 <= +h2 ? 'pm' : null), hint);
    return { time: `${pad(startH % 24)}:${pad(+(m1 || 0))}`, end: `${pad(endH % 24)}:${pad(+(m2 || 0))}` };
  }

  // 2. Range written with words and no trailing am/pm: "from 9 to 11"
  const wordRange = scanner.take(
    /\b(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:to|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\b(?!\s*[\/.-]\d)/i,
  );
  if (wordRange) {
    const [, h1, m1, ap1, h2, m2] = wordRange;
    const startH = to24h(+h1, ap1, hint);
    let endH = to24h(+h2, ap1, hint);
    if (endH < startH) endH = (endH + 12) % 24;
    return { time: `${pad(startH % 24)}:${pad(+(m1 || 0))}`, end: `${pad(endH % 24)}:${pad(+(m2 || 0))}` };
  }

  // 3. Explicit am/pm: "3pm", "3.30 pm", "10:15am"
  const ampm = scanner.take(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i);
  if (ampm) {
    const h = to24h(+ampm[1], ampm[3], null);
    return { time: `${pad(h % 24)}:${pad(+(ampm[2] || 0))}`, end: null };
  }

  // 4. 24-hour clock: "14:00", "0930hrs"
  const clock = scanner.take(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
    || scanner.take(/\b([01]\d|2[0-3])([0-5]\d)\s*(?:h|hrs|hours)\b/i);
  if (clock) return { time: `${pad(+clock[1])}:${pad(+clock[2])}`, end: null };

  // 5. Named times: "noon", "midnight"
  const named = scanner.take(/\b(noon|midday|midnight)\b/i);
  if (named) return { time: /midnight/i.test(named[1]) ? '00:00' : '12:00', end: null };

  // 6. Bare hour after a preposition: "at 3", "by 9 in the morning"
  const bare = scanner.take(/\b(?:at|@|by|around)\s*(\d{1,2})\b(?![:.\/-]?\d)/i);
  if (bare) {
    const h = to24h(+bare[1], null, hint);
    return { time: `${pad(h % 24)}:00`, end: null };
  }

  // 7. Nothing exact - fall back to the part of day, if one was mentioned.
  // The word itself is left in place because it may also carry the date.
  if (hintMatch) {
    return { time: `${pad(PART_OF_DAY[hintMatch[1].toLowerCase()])}:00`, end: null, vague: true };
  }
  return { time: null, end: null };
}

function parseDuration(scanner) {
  const m = scanner.take(/\bfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /^h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
}

/* ------------------------------------------------------------------- date */

// A bare date well in the past means next year ("5/1" said in August is next
// January). Within a week either side it is taken at face value, since that is
// far more likely a note about something that just happened than a booking a
// year out.
const PAST_GRACE_DAYS = 7;

function rollForward(d, today, hadYear) {
  if (hadYear) return d;
  const cutoff = addDays(startOfDay(today), -PAST_GRACE_DAYS);
  if (d < cutoff) d.setFullYear(d.getFullYear() + 1);
  return d;
}

function parseDate(scanner, today, dayFirst) {
  const base = startOfDay(today);

  const rel = scanner.take(/\b(today|tonight|tmr|tmrw|tomorrow|yesterday|day after tomorrow)\b/i);
  if (rel) {
    const w = rel[1].toLowerCase();
    if (w === 'yesterday') return addDays(base, -1);
    if (w === 'day after tomorrow') return addDays(base, 2);
    if (w === 'tomorrow' || w.startsWith('tm')) return addDays(base, 1);
    return base; // today / tonight
  }

  const inN = scanner.take(/\bin\s+(\d+)\s*(day|days|week|weeks|month|months)\b/i);
  if (inN) {
    const n = +inN[1];
    const unit = inN[2].toLowerCase();
    if (unit.startsWith('day')) return addDays(base, n);
    if (unit.startsWith('week')) return addDays(base, n * 7);
    const d = new Date(base);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  const wd = scanner.take(new RegExp(`\\b(next|this|coming|coming up on|on)?\\s*(${WEEKDAY_WORDS})\\b`, 'i'));
  if (wd) {
    const target = WEEKDAYS[wd[2].toLowerCase()];
    const qualifier = (wd[1] || '').trim().toLowerCase();
    let delta = (target - base.getDay() + 7) % 7;
    // "next friday" said on a Friday means a week out, not today.
    if (delta === 0 && qualifier === 'next') delta = 7;
    return addDays(base, delta);
  }

  const nextUnit = scanner.take(/\bnext\s+(week|month|year)\b/i);
  if (nextUnit) {
    const d = new Date(base);
    const u = nextUnit[1].toLowerCase();
    if (u === 'week') d.setDate(d.getDate() + 7);
    else if (u === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  // "12 Aug", "12th of August 2026"
  const dayMonth = scanner.take(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_WORDS})\\b\\.?(?:\\s*,?\\s*(\\d{4}))?`, 'i'),
  );
  if (dayMonth) {
    const day = +dayMonth[1];
    const month = MONTHS[dayMonth[2].toLowerCase()];
    const year = dayMonth[3] ? +dayMonth[3] : base.getFullYear();
    if (day >= 1 && day <= daysInMonth(year, month)) {
      return rollForward(new Date(year, month, day), today, Boolean(dayMonth[3]));
    }
  }

  // "Aug 12", "August 12th, 2026"
  const monthDay = scanner.take(
    new RegExp(`\\b(${MONTH_WORDS})\\b\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, 'i'),
  );
  if (monthDay) {
    const month = MONTHS[monthDay[1].toLowerCase()];
    const day = +monthDay[2];
    const year = monthDay[3] ? +monthDay[3] : base.getFullYear();
    if (day >= 1 && day <= daysInMonth(year, month)) {
      return rollForward(new Date(year, month, day), today, Boolean(monthDay[3]));
    }
  }

  const iso = scanner.take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // "12/8", "12-08-2026", "12.8.26"
  const num = scanner.take(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?\b/);
  if (num) {
    const a = +num[1];
    const b = +num[2];
    let day;
    let month;
    if (dayFirst) {
      // Fall back to the other reading when this one is impossible.
      if (b > 12 && a <= 12) { day = b; month = a; } else { day = a; month = b; }
    } else if (a > 12 && b <= 12) { day = a; month = b; } else { day = b; month = a; }
    let year = base.getFullYear();
    const hadYear = Boolean(num[3]);
    if (hadYear) {
      year = +num[3];
      if (year < 100) year += 2000;
    }
    month -= 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= daysInMonth(year, month)) {
      return rollForward(new Date(year, month, day), today, hadYear);
    }
  }

  return null;
}

/* --------------------------------------------------------------- location */

function tidy(s) {
  const out = s.split(MASK).join(' ').replace(/\s+/g, ' ').trim()
    .replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '');
  return out.trim();
}

/**
 * Pull "at <place>" / "in <place>" out of what is left after time and date
 * have been masked away, so "at 3pm" can never be mistaken for a place.
 */
function parseLocation(scanner) {
  const text = scanner.text;
  const re = /(?:^|[^\w@])(at|@|in)\s+([^]*)/gi;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const prepStart = m.index + m[0].indexOf(m[1]);
    const bodyStart = m.index + m[0].length - m[2].length;

    // Walk word by word, stopping at a connector, punctuation or 5 words.
    const words = [];
    let offset = 0;
    let endOffset = 0;
    for (const part of m[2].split(/(\s+)/)) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) { offset += part.length; continue; }
      const bare = part.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (LOCATION_STOP.has(bare)) break;
      words.push(part.replace(/[,;.!?]+$/, ''));
      offset += part.length;
      endOffset = offset;
      if (/[,;.!?]$/.test(part) || words.length >= 5) break;
    }

    const phrase = tidy(words.join(' '));
    // A number on its own is a stray time or date fragment, not a place.
    if (!phrase || /^\d+$/.test(phrase)) continue;
    candidates.push({ phrase, prep: m[1].toLowerCase(), start: prepStart, end: bodyStart + endOffset });
  }

  if (!candidates.length) return null;
  // "at" is a stronger location marker than "in", so prefer it when present.
  const chosen = candidates.find((c) => c.prep !== 'in') || candidates[0];
  scanner.consume(chosen.start, chosen.end);
  return chosen.phrase;
}

function parsePeople(scanner) {
  // Names are left in the subject ("Meeting with Tom") and only surfaced
  // separately, so this reads without consuming.
  const m = /\bwith\s+([A-Z][\w'’.-]*(?:\s*(?:,|and|&)\s*[A-Z][\w'’.-]*)*)/.exec(scanner.text);
  if (!m) return [];
  return m[1].split(/\s*(?:,|and|&)\s*/).map((s) => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------- main */

/**
 * @param {string} input  raw text, e.g. "lunch with Tom at KLCC 1pm tmr"
 * @param {{now?: Date|string, dayFirst?: boolean}} [opts]
 * @returns {{title: string, date: string|null, time: string|null,
 *            endTime: string|null, location: string|null, people: string[],
 *            vagueTime: boolean, raw: string}}
 */
export function parseTask(input, opts = {}) {
  const raw = String(input == null ? '' : input);
  const now = opts.now ? new Date(opts.now) : new Date();
  const dayFirst = opts.dayFirst === undefined ? DEFAULTS.dayFirst : opts.dayFirst;

  const scanner = new Scanner(raw.trim());
  const people = parsePeople(scanner);
  const { time, end, vague } = parseTime(scanner);
  const duration = parseDuration(scanner);
  const date = parseDate(scanner, now, dayFirst);
  const location = parseLocation(scanner);

  let endTime = end;
  if (!endTime && time && duration) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + duration;
    endTime = `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }

  // Whatever survived the masking is the subject.
  let title = tidy(scanner.text).replace(/\b(on|at|in|from|by|for|the)\s*$/i, '');
  const words = tidy(title).split(' ').filter(Boolean);
  while (words.length && EDGE_WORDS.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))) words.shift();
  while (words.length && EDGE_WORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  title = words.join(' ');
  if (title) title = title[0].toUpperCase() + title.slice(1);

  return {
    title: title || 'Untitled',
    date: date ? toISODate(date) : null,
    time: time || null,
    endTime: endTime || null,
    location: location || null,
    people,
    vagueTime: Boolean(vague),
    raw,
  };
}

/* ------------------------------------------------------------- formatting */

export function formatTime(hhmm, use24 = false) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (use24) return `${pad(h)}:${pad(m)}`;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${pad(m)}${suffix}`;
}

export function formatDate(iso, now = new Date()) {
  if (!iso) return 'No date';
  const d = fromISODate(iso);
  const today = startOfDay(now);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
