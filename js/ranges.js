/*
 * Workflow - date ranges for the Day / Week / Month / Year summary.
 *
 * Everything anchors on the day selected in the calendar: the week that
 * contains it, the month that contains it, the year that contains it.
 */

import { toISODate, fromISODate } from './parser.js';

export const SCOPES = ['day', 'week', 'month', 'year'];

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function dayLabel(d, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (diff === 0) return `Today · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  if (diff === -1) return `Yesterday · ${label}`;
  return label;
}

function weekLabel(start, end) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const opts = { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) };
  const format = new Intl.DateTimeFormat(undefined, opts);
  // formatRange collapses the repeated part the way the locale expects:
  // "10–16 Aug" in en-GB, "Aug 10 – 16" in en-US.
  if (typeof format.formatRange === 'function') return format.formatRange(start, end);
  return `${format.format(start)} – ${format.format(end)}`;
}

/**
 * @param {'day'|'week'|'month'|'year'} scope
 * @param {string} iso     the selected day
 * @param {number} weekStart  0 = Sunday, 1 = Monday
 * @param {Date} [now]     for the Today / Tomorrow wording
 * @returns {{start: string, end: string, label: string}} inclusive ISO bounds
 */
export function rangeFor(scope, iso, weekStart = 1, now = new Date()) {
  const d = fromISODate(iso);

  if (scope === 'week') {
    const start = addDays(d, -(((d.getDay() - weekStart) + 7) % 7));
    const end = addDays(start, 6);
    return { start: toISODate(start), end: toISODate(end), label: weekLabel(start, end) };
  }

  if (scope === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      start: toISODate(start),
      end: toISODate(end),
      label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }

  if (scope === 'year') {
    return {
      start: toISODate(new Date(d.getFullYear(), 0, 1)),
      end: toISODate(new Date(d.getFullYear(), 11, 31)),
      label: String(d.getFullYear()),
    };
  }

  return { start: iso, end: iso, label: dayLabel(d, now) };
}

/** Totals for the summary line. */
export function summarize(tasks) {
  const done = tasks.filter((t) => t.done).length;
  return { total: tasks.length, done, left: tasks.length - done };
}

/** [[iso, tasks], ...] in date order, for the day headings in long ranges. */
export function groupByDate(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** "3 tasks · 1 done · 2 holidays", dropping whatever does not apply. */
export function summaryText(tasks, holidays = 0) {
  const { total, done } = summarize(tasks);
  const parts = [];
  if (total) parts.push(`${total} ${total === 1 ? 'task' : 'tasks'}`);
  if (done) parts.push(`${done} done`);
  if (holidays) parts.push(`${holidays} ${holidays === 1 ? 'holiday' : 'holidays'}`);
  return parts.join(' · ');
}

export function emptyText(scope) {
  return {
    day: 'Nothing this day.',
    week: 'Nothing this week.',
    month: 'Nothing this month.',
    year: 'Nothing this year.',
  }[scope] || 'Nothing yet.';
}
