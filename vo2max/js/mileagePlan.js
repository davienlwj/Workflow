/*
 * Weekly mileage plan - a fixed sequence of week targets (total distance +
 * long run) anchored to a Monday start date, with progress computed against
 * actually-logged runs. Pure functions of plan + sessions + "now", using the
 * same Monday-start week convention as block.js's own mileageBuckets (kept
 * separate rather than shared, so each stays independently testable).
 */

const DAY_MS = 86400000;

function toDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-start week containing `date` (a Date), at local midnight. */
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayIdx = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dayIdx);
  return d;
}

/** The default 22-week half-marathon plan (Base -> Build -> Peak -> Taper ->
 *  Race), straight from the source training plan this feature is built
 *  from. Every number here is just a starting point - the whole feature
 *  exists so these can be freely edited afterward. Week 19's "17-18km" and
 *  week 22's "10-12km" ranges each collapse to one editable number (17.5
 *  and 11) since a plan week only tracks a single target; week 22's long
 *  run is the race distance itself (21.1km). See PHASE_GUIDE below for the
 *  session-type/mileage-split detail behind each phase's numbers. */
export const DEFAULT_PLAN_WEEKS = [
  { totalKm: 18, longRunKm: 6, note: 'Base' },
  { totalKm: 20, longRunKm: 7, note: 'Base' },
  { totalKm: 22, longRunKm: 8, note: 'Base' },
  { totalKm: 16, longRunKm: 6, note: 'Base (cutback)' },
  { totalKm: 23, longRunKm: 9, note: 'Base' },
  { totalKm: 25, longRunKm: 9, note: 'Base' },
  { totalKm: 27, longRunKm: 10, note: 'Base' },
  { totalKm: 18, longRunKm: 7, note: 'Base (cutback)' },
  { totalKm: 28, longRunKm: 11, note: 'Build' },
  { totalKm: 30, longRunKm: 12, note: 'Build' },
  { totalKm: 32, longRunKm: 12, note: 'Build' },
  { totalKm: 22, longRunKm: 8, note: 'Build (cutback)' },
  { totalKm: 33, longRunKm: 13, note: 'Build' },
  { totalKm: 35, longRunKm: 14, note: 'Build' },
  { totalKm: 37, longRunKm: 15, note: 'Build' },
  { totalKm: 24, longRunKm: 9, note: 'Build (cutback)' },
  { totalKm: 38, longRunKm: 16, note: 'Peak' },
  { totalKm: 40, longRunKm: 17, note: 'Peak' },
  { totalKm: 41, longRunKm: 17.5, note: 'Peak' },
  { totalKm: 28, longRunKm: 12, note: 'Taper' },
  { totalKm: 20, longRunKm: 8, note: 'Taper' },
  { totalKm: 11, longRunKm: 21.1, note: 'Race week' },
];

/** Read-only reference guidance behind DEFAULT_PLAN_WEEKS's numbers -
 *  which sessions make up a week in each phase, and roughly what share of
 *  that week's volume each session type should be. Shown as static
 *  context in the app (not per-plan editable data, since it describes the
 *  training method in general, not any specific set of week numbers). */
export const PHASE_GUIDE = [
  {
    phase: 'Base', weeks: 'Weeks 1–8', runsPerWeek: '4 runs/week',
    sessions: [
      '2x Easy runs — conversational pace, pure aerobic volume',
      '1x Tempo run — comfortably hard, 15–25min at threshold pace inside the run',
      '1x Long run — easy pace, building duration',
    ],
    goal: 'Build aerobic engine and running frequency before adding intensity.',
    split: { longRun: '35–38%', easy: '47–50%', tempo: '13–15%', intervals: '—' },
  },
  {
    phase: 'Build', weeks: 'Weeks 9–16', runsPerWeek: '5 runs/week from Week 13 onward',
    sessions: [
      '2x Easy runs',
      '1x Tempo run — threshold segment lengthens as weeks progress',
      '1x Intervals (from Week 13) — e.g. 6x400m or 4x800m at ~5K pace, equal-distance jog recovery',
      '1x Long run',
    ],
    goal: 'Space intervals and tempo apart (e.g. Tue intervals, Thu/Fri tempo) — never back to back.',
    split: { longRun: '33–35%', easy: '38–40%', tempo: '12–13%', intervals: '12–13%' },
  },
  {
    phase: 'Peak', weeks: 'Weeks 17–19', runsPerWeek: '5 runs/week',
    sessions: [
      '2x Easy runs',
      '1x Tempo run — longest threshold segments of the plan (up to ~30min)',
      '1x Race-pace intervals — e.g. 3x2km at goal half-marathon pace, short jog recovery',
      "1x Long run — optionally add race-pace km's in the last 5–6km (only if recovery is good)",
    ],
    goal: 'Sharpen race-specific fitness, not build more base.',
    split: { longRun: '33–35%', easy: '36–38%', tempo: '13–14%', intervals: '13–14%' },
  },
  {
    phase: 'Taper', weeks: 'Weeks 20–21', runsPerWeek: 'Volume drops, intensity stays',
    sessions: [
      '2x Easy runs — shorter than before',
      '1x Short tempo/race-pace touch — brief (10–15min), enough to stay sharp without adding fatigue',
      '1x Long run — shortened significantly (12km → 8km)',
    ],
    goal: 'Don\'t cram in "one more hard week" here.',
    split: { longRun: '38–40%', easy: '45–48%', tempo: '12–15% (short touch)', intervals: '—' },
  },
  {
    phase: 'Race week', weeks: 'Week 22', runsPerWeek: null,
    sessions: [
      'Early week: 1–2x short easy runs (3–4km), optional strides (20-second pickups to race pace)',
      '2–3 days out: full rest or shakeout jog (2–3km, easy)',
      'Race day: 21.1km',
    ],
    goal: null,
    split: null,
  },
];

/** Standalone notes from the source plan that don't belong to one phase. */
export const PHASE_GUIDE_NOTES = [
  'Starting base: 10–25km/week. Peak long run: 17–18km (not 21km - taper and race-day adrenaline cover the gap).',
  'Rule of thumb: quality work (tempo + intervals/race-pace) should never exceed ~25–28% of total weekly volume, even at peak.',
  'Weeks 4, 8, 12, and 16 are recovery/cutback weeks - non-negotiable, not optional. Volume without recovery is how injuries happen, not how fitness is built.',
];

/** Empty race details - filled in by the user via the plan's edit sheet,
 *  never guessed at (a plan doesn't necessarily target a specific race, and
 *  even one that does shouldn't have its date invented for it). */
export const DEFAULT_RACE = {
  name: '', date: '', location: '', distanceKm: null, goalTime: '', notes: '',
};

/** A fresh plan starting the Monday after `now` (i.e. "next week") - only
 *  used the very first time, before the user has ever saved one. */
export function defaultMileagePlan(now = new Date()) {
  const nextMonday = startOfWeek(now);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return {
    startDate: toISO(nextMonday),
    weeks: DEFAULT_PLAN_WEEKS.map((w) => ({ ...w })),
    race: { ...DEFAULT_RACE },
  };
}

/** Whole days from today to `race.date` (negative once the race is past,
 *  0 on race day), or null if no race date has been set. */
export function daysUntilRace(race, now = new Date()) {
  if (!race?.date) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((toDate(race.date) - today) / DAY_MS);
}

/** How many Monday-start weeks a plan needs to run from `startDate`'s week
 *  through the week containing `raceDate` (inclusive), so the plan's last
 *  week is always the race week - null if either date is missing (nothing
 *  to size against), floored at 1 (a race date before/inside week 1 still
 *  gets a 1-week plan rather than a nonsensical zero/negative one). */
export function weeksNeededForRace(startDate, raceDate) {
  if (!startDate || !raceDate) return null;
  const startMonday = startOfWeek(toDate(startDate));
  const raceMonday = startOfWeek(toDate(raceDate));
  const diffWeeks = Math.round((raceMonday - startMonday) / (DAY_MS * 7));
  return Math.max(diffWeeks + 1, 1);
}

/** Grows/shrinks `weeks` to exactly `targetCount` entries - shrinking just
 *  drops the tail, growing appends copies of the last week's targets (blank
 *  note) so new weeks aren't just zeros, the same default a manual "+ Add
 *  week" uses. Already-fine-length input is returned as-is. */
export function resizeWeeks(weeks, targetCount) {
  if (weeks.length === targetCount) return weeks;
  if (weeks.length > targetCount) return weeks.slice(0, targetCount);
  const grown = [...weeks];
  const last = grown[grown.length - 1];
  while (grown.length < targetCount) {
    grown.push({ totalKm: last?.totalKm ?? 0, longRunKm: last?.longRunKm ?? 0, note: '' });
  }
  return grown;
}

/** Index into `plan.weeks` for the Monday-start week containing `now`, or
 *  null if that's before the plan starts or after its last week ends. */
export function currentWeekIndex(plan, now = new Date()) {
  if (!plan?.startDate || !plan.weeks?.length) return null;
  const diffDays = Math.round((startOfWeek(now) - toDate(plan.startDate)) / DAY_MS);
  const idx = Math.floor(diffDays / 7);
  return idx >= 0 && idx < plan.weeks.length ? idx : null;
}

/** [from, to) Date range (Monday 00:00 to the following Monday 00:00) that
 *  `plan.weeks[weekIndex]` covers. */
export function weekDateRange(plan, weekIndex) {
  const from = toDate(plan.startDate);
  from.setDate(from.getDate() + weekIndex * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/** Completed/target/remaining km for `plan.weeks[weekIndex]`, plus its long
 *  run target and note - completed km comes from every logged run (any
 *  sport==='run' session with a distanceKm) whose date falls inside that
 *  Monday-start week. Returns null for an out-of-range index. */
export function weekProgress(plan, sessions, weekIndex) {
  const week = plan.weeks[weekIndex];
  if (!week) return null;
  const { from, to } = weekDateRange(plan, weekIndex);
  const completedKm = sessions
    .filter((s) => (s.sport ?? 'run') === 'run' && s.distanceKm != null)
    .filter((s) => { const d = toDate(s.date); return d >= from && d < to; })
    .reduce((sum, s) => sum + s.distanceKm, 0);
  const targetKm = week.totalKm;
  const remainingKm = Math.max(targetKm - completedKm, 0);
  const pct = targetKm > 0 ? Math.min(Math.round((completedKm / targetKm) * 100), 100) : 0;
  const lastDay = new Date(to);
  lastDay.setDate(lastDay.getDate() - 1);
  return {
    week: weekIndex + 1,
    totalWeeks: plan.weeks.length,
    totalKm: targetKm,
    longRunKm: week.longRunKm,
    note: week.note || '',
    completedKm: Math.round(completedKm * 10) / 10,
    remainingKm: Math.round(remainingKm * 10) / 10,
    pct,
    fromISO: toISO(from),
    toISO: toISO(lastDay),
  };
}
