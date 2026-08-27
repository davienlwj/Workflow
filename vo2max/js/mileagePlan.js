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

/** The default 13-week plan (build -> deload -> build -> deload -> peak ->
 *  taper -> race). Every number here is just a starting point - the whole
 *  feature exists so these can be freely edited afterward. Week 11's "16-
 *  17km" range and week 13's "10-12km" range each collapse to one editable
 *  number (16 and 11) since a plan week only tracks a single target. */
export const DEFAULT_PLAN_WEEKS = [
  { totalKm: 18, longRunKm: 6, note: 'Build phase' },
  { totalKm: 20, longRunKm: 7, note: '' },
  { totalKm: 22, longRunKm: 8, note: '' },
  { totalKm: 16, longRunKm: 6, note: 'Deload (cutback week)' },
  { totalKm: 24, longRunKm: 9, note: 'Build phase' },
  { totalKm: 26, longRunKm: 10, note: '' },
  { totalKm: 28, longRunKm: 11, note: '' },
  { totalKm: 20, longRunKm: 8, note: 'Deload' },
  { totalKm: 30, longRunKm: 13, note: 'Peak phase' },
  { totalKm: 32, longRunKm: 15, note: '' },
  { totalKm: 34, longRunKm: 16, note: 'Peak long run' },
  { totalKm: 20, longRunKm: 10, note: 'Taper' },
  { totalKm: 11, longRunKm: 21.1, note: 'Race week' },
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
