import {
  loadSettings, saveSettings, resetSettings,
  loadSessions, addSession, updateSession, deleteSession,
  loadWorkouts, addWorkout, updateWorkout, deleteWorkout,
  loadCustomExercises, addCustomExercise, deleteCustomExercise, updateCustomExercise,
  loadLiveWorkout, saveLiveWorkout, clearLiveWorkout,
  loadRoutines, addRoutine, updateRoutine, deleteRoutine,
  loadCustomBrands, addCustomBrand,
  exportAll, importAll,
} from './store.js';
import { lthrZoneTable, rhrZoneTable, zoneTable, hrZoneDurations } from './zones.js';
import {
  todayIso, fmtDateLong, fmtElapsed,
  daysSinceLastSession, averageSessionHR, vo2maxSeries,
  mileageBuckets, totalMileage,
  parsePaceMinKm, formatPaceMinKm,
} from './block.js';
import {
  vo2maxTrendSVG, mileageBarChartSVG, exerciseProgressSVG, exerciseVolumeSVG, muscleRadarSVG,
  restingHRTrendSVG, sleepBarChartSVG,
  activityHRLineChartSVG, activityPaceLineChartSVG, hrZoneDurationListHTML,
} from './chart.js';
import { sessionToICS, sessionToGCalEvent, workoutToGCalEvent } from './ics.js';
import {
  connect as gcalConnectFlow, silentToken as gcalSilentToken, clearToken as gcalClearToken,
  getOrCreateCalendar, upsertEvent as gcalUpsertEvent, deleteEvent as gcalDeleteEvent, CALENDAR_NAME,
} from './gcal.js';
import {
  listActivities as intervalsListActivities,
  isRunActivity as isIntervalsRunActivity,
  activityToSession as intervalsActivityToSession,
  fetchRecentWellness as intervalsFetchRecentWellness,
  fetchWellnessHistory as intervalsFetchWellnessHistory,
  fetchActivityStreams as intervalsFetchActivityStreams,
} from './intervals.js';
import {
  EXERCISES, MUSCLES, MUSCLE_LABEL, EQUIPMENT, BRANDS, RADAR_GROUP_LABEL, RADAR_GROUP_FOR,
  exerciseById, searchExercises,
} from './exercises.js';
import { muscleDiagramHTML } from './muscleDiagram.js';
import { renderWorkoutShareCard } from './shareCard.js';
import {
  workoutVolume, lastPerformance, personalRecords, newPRsInWorkout, exerciseProgress, exerciseVolumeProgress, loggedBrandsForExercise,
  loggedExerciseIds, daysSinceLastWorkout, volumeSince,
  muscleSetBreakdown, muscleSetBreakdownDetailed, workoutSummaryByExercise,
} from './workout.js';
import { runIconSVG, dumbbellIconSVG, swapIconSVG } from './icons.js';

let settings = loadSettings();

/** Applies the light/dark theme by setting the attribute style.css keys its
 *  dark-palette overrides off of, plus the PWA's browser-chrome color to
 *  match. Called on boot (as early as possible, to avoid a flash of the
 *  wrong theme) and again whenever the Settings toggle changes it. */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0a0a0a' : '#f5f5f5';
}
applyTheme(settings.theme);

let sessions = loadSessions();
let workouts = loadWorkouts();
let customExercises = loadCustomExercises();
let routines = loadRoutines();
let customBrands = loadCustomBrands();
let editingId = null;
let workoutEditingId = null;
let exerciseSheetId = null;
let exDetailBrand = ''; // '' = all brands, else a brand logged for the open exercise
let mileageScope = 'week';
let muscleRange = 'week';
let exerciseFilterMuscle = ''; // '' = all body parts, else a MUSCLES id
let exerciseSearchQuery = ''; // free-text search over the Exercises list, name substring match
let expandedRadarGroup = null;
let liveSession = null; // { startedAt } while a live "today's workout" session is running
let workoutSheetMode = 'instant'; // 'instant' | 'live' - which mode #workoutSheet is currently rendering
let liveTimerInterval = null;
let lastFinishedWorkout = null; // set by openWorkoutSummarySheet, read by "Save as Routine"
let lastFinishedDurationMs = 0; // set by openWorkoutSummarySheet, read by "Share image"
let lastFinishedNewPRs = []; // set by openWorkoutSummarySheet, read by "Share image"
let routineSelectedIds = []; // exercise ids chosen so far in the open routine builder
let editingRoutineId = null; // id of the routine being edited, or null when creating a new one
let swappingIndex = null; // index in routineSelectedIds currently being replaced via the picker, or null
let routineDrag = null; // { id, pointerId, longPressTimer, startX, startY, dragging } while reordering

const $ = (id) => document.getElementById(id);

/** The built-in library plus the user's own custom exercises, for lookups
 *  and search — a workout can reference either. */
function allExercises() {
  return [...EXERCISES, ...customExercises];
}

function findExercise(id) {
  return exerciseById(id, allExercises());
}

/** True for an exercise the user created themselves (via "+ Create new
 *  exercise") rather than one from the built-in static library. */
function isCustomExercise(id) {
  return !exerciseById(id);
}

/** The user's bodyweight from Settings > Profile, or null if not set yet -
 *  added into the load for Bodyweight-equipment exercises (dips, pull-ups)
 *  when computing volume/PRs/progress. */
function bodyweightKg() {
  return settings.profile?.weightKg ?? null;
}

/* ------------------------------------------------------------- tab views */

const VIEW_LABEL = { dashboard: 'Dashboard', run: 'Run', workout: 'Lift', settings: 'Settings' };

const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => {
    v.hidden = v.id !== `view-${name}`;
  });
  menuItems.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.view === name)));
  $('headerTitle').textContent = VIEW_LABEL[name] ?? '';
  closeMenu();
  window.scrollTo({ top: 0 });
}

function openMenu() {
  $('menuDropdown').hidden = false;
  $('menuToggle').setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  $('menuDropdown').hidden = true;
  $('menuToggle').setAttribute('aria-expanded', 'false');
}

$('menuToggle').addEventListener('click', (e) => {
  e.stopPropagation();
  if ($('menuDropdown').hidden) openMenu(); else closeMenu();
});

// Close the dropdown on any click outside it (and outside the toggle itself,
// which has its own handler above).
document.addEventListener('click', (e) => {
  if ($('menuDropdown').hidden) return;
  if (e.target.closest('#menuDropdown') || e.target.closest('#menuToggle')) return;
  closeMenu();
});

/* ------------------------------------------------------------ toast, fmt */

let toastTimer;
function toast(msg, durationMs = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, durationMs);
}

/** "🎉 New PR: Bench Press 65kg!" (or, for more than one in the same
 *  workout, "🎉 2 new PRs: Bench Press 65kg, Squat 110kg!") - for the
 *  instant/manual save path's toast, which doesn't have the summary
 *  sheet's room for a full pr-banner. See newPRsInWorkout. */
function newPRToastMessage(newPRs) {
  if (newPRs.length === 1) return `🎉 New PR: ${newPRs[0].name} ${newPRs[0].weight}kg!`;
  return `🎉 ${newPRs.length} new PRs: ${newPRs.map((p) => `${p.name} ${p.weight}kg`).join(', ')}!`;
}

/** Swap a save button into its "saved" state: darker fill, confirming text.
 *  Auto-reverts after 5s, or sooner if the form it belongs to changes. */
function markSaved(btn, savedText) {
  if (!btn.dataset.originalLabel) btn.dataset.originalLabel = btn.textContent;
  btn.textContent = savedText;
  btn.classList.add('saved');
  clearTimeout(btn._saveTimer);
  btn._saveTimer = setTimeout(() => clearSaved(btn), 5000);
}

/** Reverts a save button to its normal label/color — called on edit, timeout, or an out-of-band change. */
function clearSaved(btn) {
  clearTimeout(btn._saveTimer);
  if (!btn.classList.contains('saved')) return;
  btn.classList.remove('saved');
  btn.textContent = btn.dataset.originalLabel;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


function fmtDateShort(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Distance = duration / pace, whenever both are present; otherwise left alone for manual entry. */
function updateComputedDistance(prefix) {
  const duration = numOrNull($(`${prefix}DurationMin`).value);
  const pace = parsePaceMinKm($(`${prefix}AvgPace`).value);
  if (duration != null && pace != null && pace > 0) {
    // Rounded to 2 decimals to match the field's step="0.01".
    $(`${prefix}DistanceKm`).value = Math.round((duration / pace) * 100) / 100;
  }
}

/* --------------------------------------------------------------- LOG tab */

function sessionTypeOf(session) {
  return session.type ?? 'interval';
}

// Warm up / cool down are optional phases toggled on/off per session, each
// with its own pace/distance/HR readings kept separate from the main run's
// - both the Log and Edit forms repeat the same `${prefix}${phase}Field` id
// pattern, so one set of helpers drives all four toggle+fieldset pairs.
function readPhaseFields(prefix, phase) {
  if (!$(`${prefix}${phase}Toggle`).checked) return null;
  return {
    avgPace: parsePaceMinKm($(`${prefix}${phase}AvgPace`).value),
    distanceKm: numOrNull($(`${prefix}${phase}DistanceKm`).value),
    avgHR: numOrNull($(`${prefix}${phase}AvgHR`).value),
    maxHR: numOrNull($(`${prefix}${phase}MaxHR`).value),
  };
}

function resetPhaseFields(prefix, phase) {
  $(`${prefix}${phase}Toggle`).checked = false;
  $(`${prefix}${phase}Fields`).hidden = true;
  $(`${prefix}${phase}AvgPace`).value = '';
  $(`${prefix}${phase}DistanceKm`).value = '';
  $(`${prefix}${phase}AvgHR`).value = '';
  $(`${prefix}${phase}MaxHR`).value = '';
}

function populatePhaseFields(prefix, phase, data) {
  $(`${prefix}${phase}Toggle`).checked = Boolean(data);
  $(`${prefix}${phase}Fields`).hidden = !data;
  $(`${prefix}${phase}AvgPace`).value = data ? formatPaceMinKm(data.avgPace) : '';
  $(`${prefix}${phase}DistanceKm`).value = data?.distanceKm ?? '';
  $(`${prefix}${phase}AvgHR`).value = data?.avgHR ?? '';
  $(`${prefix}${phase}MaxHR`).value = data?.maxHR ?? '';
}

for (const prefix of ['log', 'edit']) {
  for (const phase of ['Warmup', 'Cooldown']) {
    $(`${prefix}${phase}Toggle`).addEventListener('change', () => {
      $(`${prefix}${phase}Fields`).hidden = !$(`${prefix}${phase}Toggle`).checked;
    });
  }
}

function resetLogForm() {
  $('logDate').value = todayIso();
  $('logType').value = 'interval';
  $('logDurationMin').value = '';
  $('logAvgPace').value = '';
  $('logDistanceKm').value = '';
  $('logRunAvgHR').value = '';
  $('logRunMaxHR').value = '';
  resetPhaseFields('log', 'Warmup');
  resetPhaseFields('log', 'Cooldown');
  $('logRPE').value = 6;
  $('logRPEOut').textContent = '6';
  $('logNotes').value = '';
}

$('logDurationMin').addEventListener('input', () => updateComputedDistance('log'));
$('logAvgPace').addEventListener('input', () => updateComputedDistance('log'));

$('logRPE').addEventListener('input', () => { $('logRPEOut').textContent = $('logRPE').value; });

// Every session type shares the same fields now (duration/pace/distance/HR).
// intervalsCompleted/intervals/recovery are deliberately left out of this
// object rather than zeroed out: addSession simply won't have them, and
// updateSession's patch merge (`{...existing, ...patch}`) leaves an older
// interval session's per-rep HR breakdown untouched when it's re-saved,
// since the edit form no longer collects or shows those fields.
function readSessionForm(prefix) {
  const type = $(`${prefix}Type`).value;
  // The Log form has no VO2max field (only Edit does, for filling one in after the fact).
  const vo2maxEl = $(`${prefix}VO2max`);
  return {
    type,
    date: $(`${prefix}Date`).value,
    rpe: Number($(`${prefix}RPE`).value),
    vo2max: vo2maxEl ? numOrNull(vo2maxEl.value) : null,
    notes: $(`${prefix}Notes`).value.trim(),
    durationMin: numOrNull($(`${prefix}DurationMin`).value),
    avgPace: parsePaceMinKm($(`${prefix}AvgPace`).value),
    distanceKm: numOrNull($(`${prefix}DistanceKm`).value),
    avgHR: numOrNull($(`${prefix}RunAvgHR`).value),
    maxHR: numOrNull($(`${prefix}RunMaxHR`).value),
    warmup: readPhaseFields(prefix, 'Warmup'),
    cooldown: readPhaseFields(prefix, 'Cooldown'),
  };
}

/** Opens the Log session popup for a given date (from a calendar day). */
function openLogSheet(dateIso) {
  resetLogForm();
  $('logDate').value = dateIso;
  $('scrim').hidden = false;
  $('logSheet').hidden = false;
  $('logSheet').scrollTop = 0;
}

function closeLogSheet() {
  $('scrim').hidden = true;
  $('logSheet').hidden = true;
}

$('logCancel').addEventListener('click', closeLogSheet);

$('logForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = readSessionForm('log');
  // Warn (rather than silently double-logging) if intervals.icu already
  // auto-synced a run for this same date - the user gets to decide it's
  // really a second run that day (e.g. two-a-days) instead of finding a
  // surprise duplicate later.
  const autoSyncedSameDay = sessions.find((s) => s.date === form.date && s.intervalsActivityId);
  if (autoSyncedSameDay
    && !confirm(`A run from intervals.icu was already auto-synced for ${fmtDateLong(form.date)}. Log this one too?`)) {
    return;
  }
  const saved = addSession(form);
  sessions = loadSessions();
  syncSessionToGoogle(saved);
  closeLogSheet();
  renderAll();
  toast('Session saved');
});

/* ------------------------------------------------------------- HISTORY */

const recoveryLabel = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };
// A filled-vs-outline glyph so recovery intensity reads at a glance without
// relying on color (monotone theme) or having to read the word.
const recoverySymbol = { easy: '○', moderate: '◐', hard: '●' };
const typeLabel = { interval: '4x4', 'easy-run': 'Easy run', 'long-run': 'Long run' };

/** True for sessions logged before every type shared the same fields, back
 *  when "Interval (Norwegian 4x4)" had its own per-rep HR breakdown. */
function hasLegacyIntervalData(s) {
  return Boolean(s.intervalsCompleted) || Boolean((s.intervals || []).length);
}

function renderHistory() {
  const list = $('historyList');
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = '';
  $('historyEmpty').hidden = sorted.length > 0;

  for (const s of sorted) {
    const type = sessionTypeOf(s);
    const badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
    let legacyHTML = '';
    if (hasLegacyIntervalData(s)) {
      const avgs = (s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
      const peaks = (s.intervals || []).map((iv) => iv.peakHR).filter((v) => v != null);
      const avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
      const peakHR = peaks.length ? Math.max(...peaks) : null;
      legacyHTML = `
        <span>${s.intervalsCompleted} interval${s.intervalsCompleted === 1 ? '' : 's'}</span>
        ${avgHR != null ? `<span class="mono">avg ${avgHR}</span>` : ''}
        ${peakHR != null ? `<span class="mono">peak ${peakHR}</span>` : ''}
        ${s.recovery ? `<span>${recoverySymbol[s.recovery] ?? ''} ${recoveryLabel[s.recovery] ?? s.recovery}</span>` : ''}
      `;
    }
    const metaHTML = `
      ${legacyHTML}
      ${s.durationMin != null ? `<span class="mono">${s.durationMin}min</span>` : ''}
      ${s.distanceKm != null ? `<span class="mono">${s.distanceKm}km</span>` : ''}
      ${s.avgPace != null ? `<span class="mono">${formatPaceMinKm(s.avgPace)}/km</span>` : ''}
      ${s.avgHR != null ? `<span class="mono">avg ${s.avgHR}</span>` : ''}
      ${s.maxHR != null ? `<span class="mono">max ${s.maxHR}</span>` : ''}
      <span class="mono">RPE ${s.rpe}</span>
      ${s.vo2max != null ? `<span class="mono">VO2 ${s.vo2max}</span>` : ''}
    `;

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-item';
    btn.innerHTML = `
      <div class="history-top">
        <span class="history-date">${fmtDateLong(s.date)}</span>
        ${badgeHTML}
      </div>
      <div class="history-meta">${metaHTML}</div>
      ${s.notes ? `<div class="history-notes">${escapeHTML(s.notes)}</div>` : ''}
    `;
    btn.addEventListener('click', () => openEditSheet(s));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------------------------------------------- calendar */

const now = new Date();
let calYear = now.getFullYear();
let calMonth = now.getMonth();
let calSelectedDate = null;

const CAL_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n) { return String(n).padStart(2, '0'); }
function isoOf(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

/** Runs and workouts for every date either was logged on, keyed by date. */
function activityByDate() {
  const map = new Map();
  const ensure = (date) => {
    if (!map.has(date)) map.set(date, { sessions: [], workouts: [] });
    return map.get(date);
  };
  for (const s of sessions) ensure(s.date).sessions.push(s);
  for (const w of workouts) ensure(w.date).workouts.push(w);
  return map;
}

$('calLegend').innerHTML = `
  <span class="cal-legend-item">${runIconSVG()}<span>Run</span></span>
  <span class="cal-legend-item">${dumbbellIconSVG()}<span>Workout</span></span>
`;

function renderCalendar() {
  const byDate = activityByDate();

  $('calMonthLabel').textContent = new Date(calYear, calMonth, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  $('calWeekdays').innerHTML = CAL_WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join('');

  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayIsoStr = todayIso();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell pad"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(calYear, calMonth, d);
    const day = byDate.get(iso);
    const hasRun = Boolean(day && day.sessions.length);
    const hasWorkout = Boolean(day && day.workouts.length);
    const classes = ['cal-cell'];
    if (hasRun || hasWorkout) classes.push('has-activity');
    if (iso === todayIsoStr) classes.push('today');
    if (iso === calSelectedDate) classes.push('selected');
    const iconsHTML = (hasRun || hasWorkout)
      ? `<span class="cal-icons">${hasRun ? runIconSVG() : ''}${hasWorkout ? dumbbellIconSVG() : ''}</span>`
      : '';
    html += `<button type="button" class="${classes.join(' ')}" data-date="${iso}">
      <span>${d}</span>
      ${iconsHTML}
    </button>`;
  }
  $('calGrid').innerHTML = html;
}

function renderCalDayPanel() {
  const day = activityByDate().get(calSelectedDate) || { sessions: [], workouts: [] };
  const panel = $('calDayPanel');
  panel.innerHTML = `
    <div class="cal-day-panel-date mono">${fmtDateLong(calSelectedDate)}</div>
    ${day.sessions.length ? `
      <div class="cal-day-section-label">${runIconSVG()}<span>Runs</span></div>
      ${day.sessions.map((s) => calDaySummaryHTML(s)).join('')}
    ` : ''}
    ${day.workouts.length ? `
      <div class="cal-day-section-label">${dumbbellIconSVG()}<span>Workouts</span></div>
      ${day.workouts.map((w) => calDayWorkoutSummaryHTML(w)).join('')}
    ` : ''}
    <div class="cal-day-actions">
      <button type="button" id="calLogRunBtn" class="ghost-btn">+ Log run</button>
      <button type="button" id="calLogWorkoutBtn" class="ghost-btn">+ Log workout</button>
    </div>
  `;
  panel.querySelectorAll('.cal-day-item[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = sessions.find((x) => x.id === btn.dataset.id);
      if (s) { closeCalDaySheet(); openEditSheet(s); }
    });
  });
  panel.querySelectorAll('.cal-day-item[data-workout-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = workouts.find((x) => x.id === btn.dataset.workoutId);
      if (w) { closeCalDaySheet(); openWorkoutEditSheet(w); }
    });
  });
  $('calLogRunBtn').addEventListener('click', () => {
    const iso = calSelectedDate;
    closeCalDaySheet();
    openLogSheet(iso);
  });
  $('calLogWorkoutBtn').addEventListener('click', () => {
    const iso = calSelectedDate;
    closeCalDaySheet();
    startOrOpenWorkoutFor(iso);
  });
}

/** Opens the day-detail popup (tapped from a calendar date): that day's
 *  logged runs/workouts plus +Log buttons defaulted to it. */
function openCalDaySheet(iso) {
  calSelectedDate = iso;
  renderCalendar();
  renderCalDayPanel();
  $('scrim').hidden = false;
  $('calDaySheet').hidden = false;
  $('calDaySheet').scrollTop = 0;
}

function closeCalDaySheet() {
  calSelectedDate = null;
  $('scrim').hidden = true;
  $('calDaySheet').hidden = true;
  renderCalendar();
}

$('calDaySheetClose').addEventListener('click', closeCalDaySheet);

/** A compact {badgeHTML, metaHTML} summary of one session — shared by the
 *  calendar day panel and the dashboard's recent-activity feed. */
function sessionCompactSummary(s) {
  const type = sessionTypeOf(s);
  const badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
  let metaHTML;
  if (hasLegacyIntervalData(s)) {
    const avgs = (s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
    const avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
    metaHTML = `<span class="mono">${s.intervalsCompleted} interval${s.intervalsCompleted === 1 ? '' : 's'}${avgHR != null ? ` · avg ${avgHR}` : ''}</span>`;
  } else {
    metaHTML = `<span class="mono">${[
      s.distanceKm != null ? `${s.distanceKm}km` : null,
      s.durationMin != null ? `${s.durationMin}min` : null,
    ].filter(Boolean).join(' · ')}</span>`;
  }
  return { badgeHTML, metaHTML };
}

/** A compact {badgeHTML, metaHTML} summary of one workout — same role as
 *  sessionCompactSummary, for the calendar day panel and recent activity. */
function workoutCompactSummary(w) {
  const exCount = (w.exercises || []).length;
  const badgeHTML = `<span class="pill pill-type">${w.name ? escapeHTML(w.name) : 'Workout'}</span>`;
  const metaHTML = `<span class="mono">${exCount} exercise${exCount === 1 ? '' : 's'} · ${workoutVolume(w, allExercises(), bodyweightKg())}kg</span>`;
  return { badgeHTML, metaHTML };
}

/** A simplified, at-a-glance summary of one session for the calendar day panel. */
function calDaySummaryHTML(s) {
  const { badgeHTML, metaHTML } = sessionCompactSummary(s);
  return `
    <button type="button" class="cal-day-item" data-id="${s.id}">
      ${badgeHTML}
      ${metaHTML}
    </button>
  `;
}

/** A simplified, at-a-glance summary of one workout for the calendar day panel. */
function calDayWorkoutSummaryHTML(w) {
  const { badgeHTML, metaHTML } = workoutCompactSummary(w);
  return `
    <button type="button" class="cal-day-item" data-workout-id="${w.id}">
      ${badgeHTML}
      ${metaHTML}
    </button>
  `;
}

$('calPrev').addEventListener('click', () => {
  calMonth -= 1;
  if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  renderCalendar();
});
$('calNext').addEventListener('click', () => {
  calMonth += 1;
  if (calMonth > 11) { calMonth = 0; calYear += 1; }
  renderCalendar();
});
$('calGrid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell:not(.pad)');
  if (!cell) return;
  openCalDaySheet(cell.dataset.date);
});

/* ----------------------------------------------------------- DASHBOARD */

function renderDashboard() {
  const daysSinceRun = daysSinceLastSession(sessions);
  const daysSinceWorkout = daysSinceLastWorkout(workouts);
  const weekBuckets = mileageBuckets(sessions, 'week');
  const mileageThisWeek = weekBuckets.length ? weekBuckets[weekBuckets.length - 1].km : 0;

  const tiles = [
    [String(sessions.length), 'Runs logged', true],
    [String(workouts.length), 'Workouts logged', true],
    [`${mileageThisWeek} km`, 'Mileage this week', true],
    [`${volumeSince(workouts, 7, todayIso(), allExercises(), bodyweightKg())} kg`, 'Volume this week', true],
    [daysSinceRun != null ? String(daysSinceRun) : '—', 'Days since last run', false],
    [daysSinceWorkout != null ? String(daysSinceWorkout) : '—', 'Days since last workout', false],
  ];
  const plainTilesHTML = tiles.map(([value, label, accent]) => `
    <div class="stat-tile">
      <div class="stat-value mono${accent ? ' stat-value-accent' : ''}">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  // Only shown once connected - no empty placeholder tiles for a feature
  // that isn't set up. Resting HR still hides entirely until there's an
  // actual value; Sleep shows a "Not tracked" remark instead of hiding,
  // since a connected-but-no-sleep-data state is worth surfacing rather
  // than looking identical to not being connected at all. Both are real
  // buttons (tap through to a detail chart), unlike the plain tiles above.
  const wellness = settings.intervals.enabled ? settings.intervals.wellness : null;
  let wellnessTilesHTML = '';
  if (wellness) {
    if (wellness.restingHR != null) {
      wellnessTilesHTML += `
        <button type="button" class="stat-tile stat-tile-tappable" data-tile="restingHR">
          <div class="stat-value mono">${wellness.restingHR} bpm</div>
          <div class="stat-label">Resting HR</div>
        </button>
      `;
    }
    wellnessTilesHTML += `
      <button type="button" class="stat-tile stat-tile-tappable" data-tile="sleep">
        <div class="stat-value mono">${wellness.sleepHours != null ? `${wellness.sleepHours} h` : 'Not tracked'}</div>
        <div class="stat-label">Today's Sleep</div>
      </button>
    `;
  }

  $('dashStatGrid').innerHTML = plainTilesHTML + wellnessTilesHTML;

  renderRecentActivity();
}

// Populated when either detail sheet below opens - one fetch of a generous
// window covers both metrics and every scope tab, sliced locally rather
// than re-fetched per tab (same "fetch once, slice for the scope" pattern
// the local-data charts elsewhere in the app already use).
let wellnessHistory = [];
let restingHRScope = 'month';
let sleepScope = 'week';

function sliceWellnessByDays(history, days) {
  if (days == null) return history;
  const cutoff = isoDateDaysAgo(days);
  return history.filter((p) => p.date >= cutoff);
}

function renderRestingHRChart() {
  const days = { week: 7, month: 30, year: 365, all: null }[restingHRScope];
  const points = sliceWellnessByDays(wellnessHistory, days)
    .filter((p) => p.restingHR != null)
    .map((p) => ({ date: p.date, value: p.restingHR }));
  $('restingHRChartWrap').innerHTML = restingHRTrendSVG(points);
}

function renderSleepChart() {
  const days = { week: 7, month: 30 }[sleepScope];
  const nights = sliceWellnessByDays(wellnessHistory, days)
    .filter((p) => p.sleepHours != null)
    .map((p) => ({ label: fmtDateShort(p.date), hours: p.sleepHours }));
  $('sleepChartWrap').innerHTML = sleepBarChartSVG(nights);
}

async function openWellnessDetailSheet(kind) {
  const s = settings.intervals;
  if (!s?.enabled) return;
  const sheetId = kind === 'restingHR' ? 'restingHRDetailSheet' : 'sleepDetailSheet';
  const chartWrapId = kind === 'restingHR' ? 'restingHRChartWrap' : 'sleepChartWrap';
  $('scrim').hidden = false;
  $(sheetId).hidden = false;
  $(sheetId).scrollTop = 0;
  $(chartWrapId).innerHTML = '<p class="chart-empty">Loading…</p>';
  try {
    wellnessHistory = await intervalsFetchWellnessHistory(s.athleteId, s.apiKey, isoDateDaysAgo(400), todayIso());
    if (kind === 'restingHR') renderRestingHRChart(); else renderSleepChart();
  } catch (err) {
    console.error('Failed to load wellness history', err);
    $(chartWrapId).innerHTML = '<p class="chart-empty">Could not load history from intervals.icu.</p>';
  }
}

$('dashStatGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tile]');
  if (!btn) return;
  openWellnessDetailSheet(btn.dataset.tile);
});

$('restingHRScope').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  restingHRScope = btn.dataset.scope;
  $('restingHRScope').querySelectorAll('.scope').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  renderRestingHRChart();
});
$('sleepScope').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  sleepScope = btn.dataset.scope;
  $('sleepScope').querySelectorAll('.scope').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  renderSleepChart();
});
$('restingHRDetailClose').addEventListener('click', () => {
  $('scrim').hidden = true;
  $('restingHRDetailSheet').hidden = true;
});
$('sleepDetailClose').addEventListener('click', () => {
  $('scrim').hidden = true;
  $('sleepDetailSheet').hidden = true;
});

/** HR zone durations, HR-over-time and pace-over-time for one auto-synced
 *  run, read from intervals.icu's raw stream data. Zone durations are
 *  computed locally against this app's own zone table (whichever model is
 *  primary in Settings) rather than trusting intervals.icu's own zone
 *  config, which the user may never have set up to match. The summary stat
 *  row above the charts comes straight from the session itself (already
 *  known, no fetch needed) - these are the activity's own reported
 *  distance/duration/avg pace/avg+max HR, which are more reliable than
 *  anything re-derived from the noisy raw sample stream. */
async function openActivityDetailSheet(session) {
  const s = settings.intervals;
  if (!s?.enabled || !session.intervalsActivityId) return;
  $('activityDetailStats').innerHTML = `
    <div class="stat-tile"><div class="stat-value mono">${session.distanceKm ?? '–'}km</div><div class="stat-label">Distance</div></div>
    <div class="stat-tile"><div class="stat-value mono">${session.durationMin ?? '–'}min</div><div class="stat-label">Duration</div></div>
    <div class="stat-tile"><div class="stat-value mono">${session.avgPace != null ? `${formatPaceMinKm(session.avgPace)}/km` : '–'}</div><div class="stat-label">Avg Pace</div></div>
    <div class="stat-tile"><div class="stat-value mono">${session.avgHR ?? '–'} / ${session.maxHR ?? '–'}</div><div class="stat-label">Avg / Max HR</div></div>
  `;
  $('scrim').hidden = false;
  $('activityDetailSheet').hidden = false;
  $('activityDetailSheet').scrollTop = 0;
  const loading = '<p class="chart-empty">Loading…</p>';
  $('activityZoneChartWrap').innerHTML = loading;
  $('activityHRChartWrap').innerHTML = loading;
  $('activityPaceChartWrap').innerHTML = loading;
  try {
    const points = await intervalsFetchActivityStreams(session.intervalsActivityId, s.apiKey);
    const table = zoneTable(settings, settings.primaryZoneModel);
    $('activityZoneChartWrap').innerHTML = hrZoneDurationListHTML(hrZoneDurations(points, table));
    $('activityHRChartWrap').innerHTML = activityHRLineChartSVG(points, table);
    $('activityPaceChartWrap').innerHTML = activityPaceLineChartSVG(points);
  } catch (err) {
    console.error('Failed to load activity streams', err);
    const failMsg = '<p class="chart-empty">Could not load activity detail from intervals.icu.</p>';
    $('activityZoneChartWrap').innerHTML = failMsg;
    $('activityHRChartWrap').innerHTML = failMsg;
    $('activityPaceChartWrap').innerHTML = failMsg;
  }
}

$('editViewActivityDetail').addEventListener('click', () => {
  const session = sessions.find((s) => s.id === editingId);
  if (session) openActivityDetailSheet(session);
});
$('activityDetailClose').addEventListener('click', () => {
  $('scrim').hidden = true;
  $('activityDetailSheet').hidden = true;
});

const RECENT_ACTIVITY_LIMIT = 6;

function renderRecentActivity() {
  const items = [
    ...sessions.map((s) => ({ date: s.date, id: s.id, kind: 'run', data: s })),
    ...workouts.map((w) => ({ date: w.date, id: w.id, kind: 'workout', data: w })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_ACTIVITY_LIMIT);

  $('recentActivityEmpty').hidden = items.length > 0;
  $('recentActivityList').innerHTML = items.map((item) => {
    const { badgeHTML, metaHTML } = item.kind === 'run'
      ? sessionCompactSummary(item.data)
      : workoutCompactSummary(item.data);
    const icon = item.kind === 'run' ? runIconSVG() : dumbbellIconSVG();
    return `
      <li>
        <button type="button" class="history-item" data-kind="${item.kind}" data-id="${item.id}">
          <div class="history-top">
            <span class="history-date">${icon}${fmtDateLong(item.date)}</span>
            ${badgeHTML}
          </div>
          <div class="history-meta">${metaHTML}</div>
        </button>
      </li>
    `;
  }).join('');
}

$('recentActivityList').addEventListener('click', (e) => {
  const btn = e.target.closest('.history-item');
  if (!btn) return;
  if (btn.dataset.kind === 'run') {
    const s = sessions.find((x) => x.id === btn.dataset.id);
    if (s) openEditSheet(s);
  } else {
    const w = workouts.find((x) => x.id === btn.dataset.id);
    if (w) openWorkoutEditSheet(w);
  }
});

/* --------------------------------------------------------- edit sheet */

function openEditSheet(session) {
  editingId = session.id;
  const type = sessionTypeOf(session);
  $('editDate').value = session.date;
  $('editType').value = type;
  $('editDurationMin').value = session.durationMin ?? '';
  $('editAvgPace').value = formatPaceMinKm(session.avgPace);
  $('editDistanceKm').value = session.distanceKm ?? '';
  $('editRunAvgHR').value = session.avgHR ?? '';
  $('editRunMaxHR').value = session.maxHR ?? '';
  populatePhaseFields('edit', 'Warmup', session.warmup);
  populatePhaseFields('edit', 'Cooldown', session.cooldown);
  $('editRPE').value = session.rpe;
  $('editRPEOut').textContent = String(session.rpe);
  $('editVO2max').value = session.vo2max ?? '';
  $('editNotes').value = session.notes ?? '';
  $('editViewActivityDetail').hidden = !session.intervalsActivityId;
  $('scrim').hidden = false;
  $('editSheet').hidden = false;
  $('editSheet').scrollTop = 0;
}

function closeEditSheet() {
  editingId = null;
  $('scrim').hidden = true;
  $('editSheet').hidden = true;
}

$('scrim').addEventListener('click', () => {
  closeEditSheet();
  closeLogSheet();
  closeWorkoutSheet();
  closeExerciseSheet();
  closeCalDaySheet();
  closeStartChoiceSheet();
  closeRoutinesSheet();
  closeRoutineBuilderSheet();
  $('workoutSummarySheet').hidden = true;
  $('restingHRDetailSheet').hidden = true;
  $('sleepDetailSheet').hidden = true;
  $('activityDetailSheet').hidden = true;
});
$('editCancel').addEventListener('click', closeEditSheet);

$('editDurationMin').addEventListener('input', () => updateComputedDistance('edit'));
$('editAvgPace').addEventListener('input', () => updateComputedDistance('edit'));

$('editRPE').addEventListener('input', () => { $('editRPEOut').textContent = $('editRPE').value; });

$('editAddToCalendar').addEventListener('click', () => {
  const session = sessions.find((s) => s.id === editingId);
  if (!session) return;
  downloadFile(`vo2max-session-${session.date}.ics`, sessionToICS(session), 'text/calendar');
  toast('Calendar file downloaded');
});

$('editForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!editingId) return;
  const saved = updateSession(editingId, readSessionForm('edit'));
  sessions = loadSessions();
  if (saved) syncSessionToGoogle(saved);
  closeEditSheet();
  renderAll();
  toast('Session updated');
});

$('editDelete').addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('Delete this session? This cannot be undone.')) return;
  const toDelete = sessions.find((s) => s.id === editingId);
  deleteSession(editingId);
  sessions = loadSessions();
  if (toDelete) deleteSessionFromGoogle(toDelete);
  closeEditSheet();
  renderAll();
  toast('Session deleted');
});

/* ------------------------------------------------------------------ RUN */

function renderRunTab() {
  const avgHR = averageSessionHR(sessions);
  const daysSince = daysSinceLastSession(sessions);

  $('statGrid').innerHTML = [
    [String(sessions.length), 'Sessions logged', true],
    [avgHR != null ? `${avgHR}` : '—', 'Avg session HR', true],
    [daysSince != null ? String(daysSince) : '—', 'Days since last session', false],
  ].map(([value, label, accent]) => `
    <div class="stat-tile">
      <div class="stat-value mono${accent ? ' stat-value-accent' : ''}">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  $('chartWrap').innerHTML = vo2maxTrendSVG(vo2maxSeries(settings, sessions));

  $('mileageTotal').textContent = `${totalMileage(sessions)} km total`;
  $('mileageChartWrap').innerHTML = mileageBarChartSVG(mileageBuckets(sessions, mileageScope));
}

$('startRunBtn').addEventListener('click', () => openLogSheet(todayIso()));

$('mileageScope').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  mileageScope = btn.dataset.scope;
  $('mileageScope').querySelectorAll('.scope').forEach((b) => {
    b.setAttribute('aria-selected', String(b === btn));
  });
  $('mileageChartWrap').innerHTML = mileageBarChartSVG(mileageBuckets(sessions, mileageScope));
});

/* -------------------------------------------------------------- WORKOUT */

function exerciseMetaText(ex) {
  return `${ex.equipment} · ${ex.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}`;
}

const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];
const SET_TYPE_GLYPH = { normal: 'N', warmup: 'W', drop: 'D', failure: 'F' };
const SET_TYPE_LABEL = { normal: 'Normal set', warmup: 'Warm-up set', drop: 'Drop set', failure: 'Failure set' };

/** @param {{weight:number, reps:number}} [prevSet] the matching set index from
 *  lastPerformance(), shown as this row's placeholder so today's target is
 *  visible while filling it in, not just in the summary line above.
 *  The done tick is live-session only - meaningless when retrospectively
 *  filling in a past date, so it's gated on workoutSheetMode. */
function setRowHTML(index, set = {}, prevSet) {
  const type = set.type || 'normal';
  const doneHTML = workoutSheetMode === 'live'
    ? `<button type="button" class="wo-set-done" data-done="${set.done ? 'true' : 'false'}" aria-label="Mark set done">${set.done ? '✓' : ''}</button>`
    : '';
  return `
    <div class="wo-set-row" data-type="${type}">
      <button type="button" class="wo-set-type" data-type="${type}" title="${SET_TYPE_LABEL[type]} — tap to change">${SET_TYPE_GLYPH[type]}</button>
      <span class="wo-set-index">${index + 1}</span>
      <input type="number" class="wo-set-weight" step="0.5" min="0" inputmode="decimal" placeholder="${prevSet?.weight ?? 'kg'}" value="${set.weight ?? ''}">
      <input type="number" class="wo-set-reps" min="0" inputmode="numeric" placeholder="${prevSet?.reps ?? 'reps'}" value="${set.reps ?? ''}">
      ${doneHTML}
      <button type="button" class="wo-set-remove" aria-label="Remove set">✕</button>
    </div>
  `;
}

function cycleSetType(btn) {
  const next = SET_TYPES[(SET_TYPES.indexOf(btn.dataset.type) + 1) % SET_TYPES.length];
  btn.dataset.type = next;
  btn.textContent = SET_TYPE_GLYPH[next];
  btn.title = `${SET_TYPE_LABEL[next]} — tap to change`;
  btn.closest('.wo-set-row').dataset.type = next;
}

/** Machine/Cable equipment only - a resistance profile differs enough by
 *  brand to be worth recording per logged exercise. `selected` is the
 *  currently-chosen brand (or falsy for the "-" default). */
function brandOptionsHTML(selected) {
  const all = [...BRANDS, ...customBrands];
  const options = all
    .map((b) => `<option value="${escapeHTML(b)}"${b === selected ? ' selected' : ''}>${escapeHTML(b)}</option>`)
    .join('');
  return `<option value="">-</option>${options}<option value="__add__">+ Add brand…</option>`;
}

/** @param {string} [supersetId] if this exercise is already paired into a
 *  superset, its group id — suppresses the "⚭ Superset" button (v1 only
 *  supports pairs, formed/broken via that button and the group's unpair ✕).
 * @param {string} [brand] the machine brand last chosen for this exercise
 *  entry (Machine/Cable equipment only - see brandOptionsHTML). */
function exerciseBlockHTML(exerciseId, sets, supersetId, brand) {
  const ex = findExercise(exerciseId);
  if (!ex) return '';
  const last = lastPerformance(workouts, exerciseId);
  const lastText = last
    ? `Last (${fmtDateShort(last.date)}${last.brand ? `, ${last.brand}` : ''}): ${last.sets.map((s) => `${s.weight}kg×${s.reps}`).join(', ') || '—'}`
    : 'No previous data for this exercise';
  const supersetBtnHTML = supersetId ? '' : '<button type="button" class="wo-superset-btn" title="Superset with another exercise">⚭</button>';
  const bw = bodyweightKg();
  const bwHintHTML = ex.equipment !== 'Bodyweight' ? '' : bw
    ? `<p class="wo-bodyweight-hint">Your bodyweight (${bw}kg) is added automatically — the kg field below is just extra weight (e.g. a belt or vest), leave it blank for bodyweight only.</p>`
    : `<p class="wo-bodyweight-hint">Set your weight in Settings → Profile to include your bodyweight in this exercise's volume. The kg field below is extra weight only.</p>`;
  const isBrandable = ex.equipment === 'Machine' || ex.equipment === 'Cable';
  const brandHTML = !isBrandable ? '' : `
    <div class="wo-brand-row">
      <span>Machine</span>
      <select class="wo-brand-select">${brandOptionsHTML(brand)}</select>
    </div>
  `;
  return `
    <div class="wo-exercise-block" data-exercise-id="${exerciseId}"${supersetId ? ` data-superset-id="${supersetId}"` : ''}${isBrandable && brand ? ` data-brand="${escapeHTML(brand)}"` : ''}>
      <div class="wo-exercise-header">
        <div>
          <div class="wo-exercise-name">${escapeHTML(ex.name)}</div>
          <div class="wo-exercise-meta">${escapeHTML(exerciseMetaText(ex))}</div>
        </div>
        <div class="wo-exercise-header-actions">
          ${supersetBtnHTML}
          <button type="button" class="wo-exercise-remove" aria-label="Remove exercise">✕</button>
        </div>
      </div>
      ${muscleDiagramHTML(ex.muscles)}
      <p class="wo-last-performance">${lastText}</p>
      ${bwHintHTML}
      ${brandHTML}
      <div class="wo-set-row-heading"><span></span><span>Set</span><span>kg</span><span>Reps</span>${workoutSheetMode === 'live' ? '<span></span>' : ''}<span></span></div>
      <div class="wo-set-rows">${sets.map((s, i) => setRowHTML(i, s, last?.sets[i])).join('')}</div>
      <button type="button" class="wo-add-set ghost-btn">+ Add set</button>
    </div>
  `;
}

/* ------------------------------------------------------------- supersets */

function makeShortId() {
  return Math.random().toString(36).slice(2, 8);
}

function supersetLabelHTML() {
  return `
    <div class="wo-superset-label">
      <span>⚭ Superset</span>
      <button type="button" class="wo-superset-unpair" aria-label="Remove superset pairing">✕</button>
    </div>
  `;
}

/** Wraps `blocks` (already-in-DOM .wo-exercise-block elements) in a shared
 *  .wo-superset-group container, tagging each with `supersetId`. */
function wrapAsSupersetGroup(blocks, supersetId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'wo-superset-group';
  wrapper.dataset.supersetId = supersetId;
  wrapper.innerHTML = supersetLabelHTML();
  blocks[0].parentNode.insertBefore(wrapper, blocks[0]);
  blocks.forEach((b) => {
    b.dataset.supersetId = supersetId;
    b.querySelector('.wo-superset-btn')?.remove();
    wrapper.appendChild(b);
  });
}

/** Un-pairs every block in a .wo-superset-group, restoring the "⚭ Superset"
 *  button on any that lost it when it was originally rendered pre-paired. */
function unwrapSuperset(wrapper) {
  const blocks = [...wrapper.querySelectorAll('.wo-exercise-block')];
  blocks.forEach((b) => {
    delete b.dataset.supersetId;
    const actions = b.querySelector('.wo-exercise-header-actions');
    if (actions && !actions.querySelector('.wo-superset-btn')) {
      actions.insertAdjacentHTML('afterbegin', '<button type="button" class="wo-superset-btn" title="Superset with another exercise">⚭</button>');
    }
    wrapper.parentNode.insertBefore(b, wrapper);
  });
  wrapper.remove();
}

/** Re-groups exercise blocks that already share a supersetId - used after
 *  bulk-rendering a saved workout's exercises (openWorkoutEditSheet), since
 *  exerciseBlockHTML renders each block flat and grouping happens after. */
function regroupSupersets() {
  const groups = new Map();
  $('woExerciseList').querySelectorAll(':scope > .wo-exercise-block[data-superset-id]').forEach((b) => {
    const id = b.dataset.supersetId;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(b);
  });
  groups.forEach((blocks, id) => { if (blocks.length > 1) wrapAsSupersetGroup(blocks, id); });
}

let pairingSourceBlock = null;

function renumberSets(block) {
  block.querySelectorAll('.wo-set-row').forEach((row, i) => {
    row.querySelector('.wo-set-index').textContent = String(i + 1);
  });
}

function renderWoPickerChips() {
  $('woPickerChips').innerHTML = MUSCLES.map((m) => `<button type="button" class="chip" data-muscle="${m}">${MUSCLE_LABEL[m]}</button>`).join('');
}

function renderWoPickerResults() {
  const q = $('woPickerSearch').value;
  const muscle = $('woPickerChips').querySelector('.chip.active')?.dataset.muscle || '';
  const results = searchExercises(q, muscle, allExercises());
  $('woPickerResults').innerHTML = results.length
    ? results.map((e) => `
      <button type="button" class="wo-picker-result" data-id="${e.id}">
        <span>${escapeHTML(e.name)}</span>
        <span class="wo-picker-result-meta">${escapeHTML(e.equipment)}</span>
      </button>
    `).join('')
    : '<p class="empty">No matching exercises.</p>';
}

/* ---------------------------------------------------- create new exercise */

function renderNewExMuscleChips() {
  $('newExMuscles').innerHTML = MUSCLES.map((m) => `<button type="button" class="chip" data-muscle="${m}">${MUSCLE_LABEL[m]}</button>`).join('');
}

function resetNewExerciseForm() {
  $('newExName').value = '';
  $('newExEquipment').innerHTML = EQUIPMENT.map((eq) => `<option value="${eq}">${eq}</option>`).join('');
  renderNewExMuscleChips();
}

function openNewExerciseForm() {
  resetNewExerciseForm();
  $('woNewExerciseForm').hidden = false;
  $('woPickerResults').hidden = true;
  $('newExName').focus();
}

function closeNewExerciseForm() {
  $('woNewExerciseForm').hidden = true;
  $('woPickerResults').hidden = false;
}

$('woNewExerciseBtn').addEventListener('click', openNewExerciseForm);
$('newExCancel').addEventListener('click', closeNewExerciseForm);

// Multi-select: unlike the filter chips above (only one active at a time),
// each tap here toggles just that one chip, since an exercise can work
// several body parts at once.
$('newExMuscles').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  chip.classList.toggle('active');
});

$('newExSave').addEventListener('click', () => {
  const name = $('newExName').value.trim();
  const equipment = $('newExEquipment').value;
  const muscles = [...$('newExMuscles').querySelectorAll('.chip.active')].map((c) => c.dataset.muscle);
  if (!name) { toast('Enter an exercise name'); return; }
  if (muscles.length === 0) { toast('Pick at least one body part'); return; }
  addCustomExercise({ name, equipment, muscles });
  customExercises = loadCustomExercises();
  closeNewExerciseForm();
  renderWoPickerResults();
  toast('Exercise added');
});

/** Opens the exercise picker - either to add a normal exercise, or (when
 *  pairingSourceBlock is set) to pick this exercise's superset partner. */
function openWoPicker() {
  $('woPicker').hidden = false;
  $('woPickerSearch').value = '';
  renderWoPickerChips();
  renderWoPickerResults();
  closeNewExerciseForm();
  const hint = $('woPickerHint');
  if (pairingSourceBlock) {
    const name = pairingSourceBlock.querySelector('.wo-exercise-name')?.textContent || 'this exercise';
    hint.textContent = `Pick an exercise to superset with ${name}`;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
  $('woPickerSearch').focus();
}

$('woAddExercise').addEventListener('click', () => {
  const opening = $('woPicker').hidden;
  pairingSourceBlock = null;
  if (opening) {
    openWoPicker();
  } else {
    $('woPicker').hidden = true;
  }
});

$('woPickerChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const wasActive = chip.classList.contains('active');
  $('woPickerChips').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  if (!wasActive) chip.classList.add('active');
  renderWoPickerResults();
});

$('woPickerSearch').addEventListener('input', renderWoPickerResults);

$('woPickerResults').addEventListener('click', (e) => {
  const btn = e.target.closest('.wo-picker-result');
  if (!btn) return;
  $('woExerciseList').insertAdjacentHTML('beforeend', exerciseBlockHTML(btn.dataset.id, [{}]));
  if (pairingSourceBlock) {
    wrapAsSupersetGroup([pairingSourceBlock, $('woExerciseList').lastElementChild], `superset-${makeShortId()}`);
    pairingSourceBlock = null;
  }
  $('woPicker').hidden = true;
  $('woPickerHint').hidden = true;
  syncLiveWorkout();
});

$('woExerciseList').addEventListener('click', (e) => {
  const doneBtn = e.target.closest('.wo-set-done');
  if (doneBtn) {
    const isDone = doneBtn.dataset.done === 'true';
    doneBtn.dataset.done = String(!isDone);
    doneBtn.textContent = isDone ? '' : '✓';
    syncLiveWorkout();
    return;
  }
  const typeBtn = e.target.closest('.wo-set-type');
  if (typeBtn) {
    cycleSetType(typeBtn);
    syncLiveWorkout();
    return;
  }
  const supersetBtn = e.target.closest('.wo-superset-btn');
  if (supersetBtn) {
    pairingSourceBlock = supersetBtn.closest('.wo-exercise-block');
    openWoPicker();
    return;
  }
  const unpairBtn = e.target.closest('.wo-superset-unpair');
  if (unpairBtn) {
    unwrapSuperset(unpairBtn.closest('.wo-superset-group'));
    syncLiveWorkout();
    return;
  }
  const removeExBtn = e.target.closest('.wo-exercise-remove');
  if (removeExBtn) {
    const block = removeExBtn.closest('.wo-exercise-block');
    const group = block.closest('.wo-superset-group');
    block.remove();
    if (group && group.querySelectorAll('.wo-exercise-block').length < 2) unwrapSuperset(group);
    syncLiveWorkout();
    return;
  }
  const addSetBtn = e.target.closest('.wo-add-set');
  if (addSetBtn) {
    const block = addSetBtn.closest('.wo-exercise-block');
    const rows = block.querySelector('.wo-set-rows');
    const last = lastPerformance(workouts, block.dataset.exerciseId);
    rows.insertAdjacentHTML('beforeend', setRowHTML(rows.children.length, {}, last?.sets[rows.children.length]));
    syncLiveWorkout();
    return;
  }
  const removeSetBtn = e.target.closest('.wo-set-remove');
  if (removeSetBtn) {
    const block = removeSetBtn.closest('.wo-exercise-block');
    const rows = block.querySelector('.wo-set-rows');
    if (rows.children.length > 1) {
      removeSetBtn.closest('.wo-set-row').remove();
      renumberSets(block);
      syncLiveWorkout();
    }
  }
});

/** Re-renders every brand <select>'s options (e.g. after a new custom brand
 *  is added) while preserving each one's currently-chosen value. */
function refreshBrandSelects() {
  $('woExerciseList').querySelectorAll('.wo-brand-select').forEach((select) => {
    select.innerHTML = brandOptionsHTML(select.closest('.wo-exercise-block').dataset.brand || '');
  });
}

$('woExerciseList').addEventListener('change', (e) => {
  const select = e.target.closest('.wo-brand-select');
  if (!select) return;
  const block = select.closest('.wo-exercise-block');
  if (select.value === '__add__') {
    const name = window.prompt('New brand name:')?.trim();
    if (name) {
      addCustomBrand(name);
      customBrands = loadCustomBrands();
      refreshBrandSelects();
      select.value = name;
      block.dataset.brand = name;
    } else {
      select.value = block.dataset.brand || '';
    }
  } else if (select.value) {
    block.dataset.brand = select.value;
  } else {
    delete block.dataset.brand;
  }
  syncLiveWorkout();
});

function readWorkoutForm() {
  const exercises = [...$('woExerciseList').querySelectorAll('.wo-exercise-block')].map((block) => ({
    exerciseId: block.dataset.exerciseId,
    supersetId: block.dataset.supersetId || null,
    brand: block.dataset.brand || null,
    sets: [...block.querySelectorAll('.wo-set-row')]
      .map((row) => {
        const doneEl = row.querySelector('.wo-set-done');
        const set = {
          weight: numOrNull(row.querySelector('.wo-set-weight').value),
          reps: numOrNull(row.querySelector('.wo-set-reps').value),
          type: row.querySelector('.wo-set-type').dataset.type,
        };
        if (doneEl) set.done = doneEl.dataset.done === 'true';
        return set;
      })
      .filter((s) => s.weight != null || s.reps != null),
  }));
  return {
    date: $('woDate').value,
    name: $('woName').value.trim(),
    notes: $('woNotes').value.trim(),
    exercises,
  };
}

/** Opens the workout sheet blank, for logging a new workout (defaults to today). */
function openWorkoutSheet(dateIso) {
  if (liveSession) { toast('Finish or cancel your live workout first'); return; }
  workoutEditingId = null;
  pairingSourceBlock = null;
  setWorkoutSheetLiveMode(false);
  $('woDate').value = dateIso || todayIso();
  $('woName').value = '';
  $('woNotes').value = '';
  $('woExerciseList').innerHTML = '';
  $('woPicker').hidden = true;
  $('woDelete').hidden = true;
  $('woSave').textContent = 'Save workout';
  $('scrim').hidden = false;
  $('workoutSheet').hidden = false;
  $('workoutSheet').scrollTop = 0;
}

/** Opens the workout sheet pre-filled, for editing a past workout from History. */
function openWorkoutEditSheet(workout) {
  if (liveSession) { toast('Finish or cancel your live workout first'); return; }
  workoutEditingId = workout.id;
  pairingSourceBlock = null;
  setWorkoutSheetLiveMode(false);
  $('woDate').value = workout.date;
  $('woName').value = workout.name || '';
  $('woNotes').value = workout.notes || '';
  $('woExerciseList').innerHTML = (workout.exercises || [])
    .map((ex) => exerciseBlockHTML(ex.exerciseId, ex.sets && ex.sets.length ? ex.sets : [{}], ex.supersetId, ex.brand))
    .join('');
  regroupSupersets();
  $('woPicker').hidden = true;
  $('woDelete').hidden = false;
  $('woSave').textContent = 'Update workout';
  $('scrim').hidden = false;
  $('workoutSheet').hidden = false;
  $('workoutSheet').scrollTop = 0;
}

function closeWorkoutSheet() {
  workoutEditingId = null;
  $('scrim').hidden = true;
  $('workoutSheet').hidden = true;
  // A live session's DOM/state is never cleared just by hiding the sheet -
  // closing it while one is still running is a minimize, not a discard.
  if (liveSession) showLiveMiniBar();
}

/* --------------------------------------------------------- live session */

function showLiveMiniBar() {
  $('liveMiniBar').hidden = false;
  $('main').classList.add('has-live-bar');
  updateLiveMiniBar();
}

function hideLiveMiniBar() {
  $('liveMiniBar').hidden = true;
  $('main').classList.remove('has-live-bar');
}


/** Scans the live sheet's current DOM for the first exercise with an
 *  un-ticked set, for the mini-bar's "current exercise / current set" copy. */
function computeLiveProgress() {
  const blocks = [...$('woExerciseList').querySelectorAll('.wo-exercise-block')];
  for (const block of blocks) {
    const rows = [...block.querySelectorAll('.wo-set-row')];
    const undoneIndex = rows.findIndex((r) => r.querySelector('.wo-set-done')?.dataset.done !== 'true');
    if (undoneIndex !== -1) {
      return {
        exercise: block.querySelector('.wo-exercise-name')?.textContent || '',
        setLabel: `Set ${undoneIndex + 1} of ${rows.length}`,
      };
    }
  }
  return { exercise: blocks.length ? 'All sets done' : 'No exercises yet', setLabel: '' };
}

function updateLiveMiniBar() {
  if (!liveSession) return;
  const progress = computeLiveProgress();
  $('liveMiniExercise').textContent = progress.exercise;
  $('liveMiniSet').textContent = progress.setLabel;
}

function tickLiveTimer() {
  if (!liveSession) return;
  const text = fmtElapsed(Date.now() - new Date(liveSession.startedAt).getTime());
  $('woLiveTimerText').textContent = text;
  $('liveMiniTimer').textContent = text;
}

function startLiveTimer() {
  stopLiveTimer();
  tickLiveTimer();
  liveTimerInterval = setInterval(tickLiveTimer, 1000);
}

function stopLiveTimer() {
  clearInterval(liveTimerInterval);
  liveTimerInterval = null;
}

function saveLiveWorkoutState() {
  if (!liveSession) return;
  saveLiveWorkout({ ...readWorkoutForm(), startedAt: liveSession.startedAt });
}

/** Called after any change to the live sheet's exercises/sets - keeps the
 *  persisted session and the mini-bar's progress copy both up to date. */
function syncLiveWorkout() {
  saveLiveWorkoutState();
  updateLiveMiniBar();
}

function setWorkoutSheetLiveMode(isLive) {
  workoutSheetMode = isLive ? 'live' : 'instant';
  $('workoutSheet').classList.toggle('live-mode', isLive);
  $('woLiveTimer').hidden = !isLive;
  $('woSave').textContent = isLive ? 'Finish Workout' : 'Save workout';
  $('woCancel').textContent = isLive ? 'Cancel workout' : 'Cancel';
}

/** Fully discards the running live session (used by "Cancel workout" and
 *  once a finished workout has been saved) - unlike closeWorkoutSheet(),
 *  this clears the persisted session and hides the mini-bar for good. */
function discardLiveWorkout() {
  stopLiveTimer();
  liveSession = null;
  clearLiveWorkout();
  hideLiveMiniBar();
  workoutEditingId = null;
  $('scrim').hidden = true;
  $('workoutSheet').hidden = true;
  $('workoutSheet').classList.remove('live-mode');
  workoutSheetMode = 'instant';
}

/** Opens #workoutSheet in a fresh live session: running timer, tick marks,
 *  persisted so backgrounding the PWA mid-workout doesn't lose it.
 * @param {string[]} [exerciseIds] pre-load these exercises (one empty set
 *  each) instead of starting blank - used when starting from a routine. */
function openLiveWorkoutSheet(exerciseIds = []) {
  workoutEditingId = null;
  pairingSourceBlock = null;
  liveSession = { startedAt: new Date().toISOString() };
  setWorkoutSheetLiveMode(true);
  $('woDate').value = todayIso();
  $('woName').value = '';
  $('woNotes').value = '';
  $('woExerciseList').innerHTML = exerciseIds.map((id) => exerciseBlockHTML(id, [{}])).join('');
  $('woPicker').hidden = true;
  $('woDelete').hidden = true;
  saveLiveWorkoutState();
  startLiveTimer();
  hideLiveMiniBar();
  $('scrim').hidden = false;
  $('workoutSheet').hidden = false;
  $('workoutSheet').scrollTop = 0;
}

/** Re-opens the full sheet on an already-running live session (resuming
 *  from the mini-bar, or from "Start Workout" while one is in progress) -
 *  the DOM/state was never touched while minimized, so nothing to rebuild. */
function reopenLiveWorkoutSheet() {
  setWorkoutSheetLiveMode(true);
  hideLiveMiniBar();
  $('scrim').hidden = false;
  $('workoutSheet').hidden = false;
  $('workoutSheet').scrollTop = 0;
}

/** Routes "Start Workout" / a calendar day's "+ Log workout": today's date
 *  with no session yet running asks whether to start from a routine or
 *  blank; an already-running session just resumes; any other date keeps
 *  using the plain instant form, since a timer/tick-off flow only makes
 *  sense for something not yet done. */
function startOrOpenWorkoutFor(iso) {
  if (iso !== todayIso()) { openWorkoutSheet(iso); return; }
  if (liveSession) { reopenLiveWorkoutSheet(); return; }
  openStartChoiceSheet();
}

function openStartChoiceSheet() {
  $('scrim').hidden = false;
  $('startChoiceSheet').hidden = false;
}

function closeStartChoiceSheet() {
  $('scrim').hidden = true;
  $('startChoiceSheet').hidden = true;
}

$('startChoiceNew').addEventListener('click', () => {
  closeStartChoiceSheet();
  openLiveWorkoutSheet();
});

$('startChoiceRoutine').addEventListener('click', () => {
  closeStartChoiceSheet();
  openRoutinesSheet();
});

/* ------------------------------------------------------------- routines */

function routineRowHTML(routine) {
  const count = routine.exerciseIds.length;
  return `
    <li class="routine-row">
      <button type="button" class="history-item routine-item" data-id="${routine.id}">
        <div class="history-top">
          <span class="history-date">${escapeHTML(routine.name)}</span>
        </div>
        <div class="history-meta"><span>${count} exercise${count === 1 ? '' : 's'}</span></div>
      </button>
      <button type="button" class="routine-edit" data-id="${routine.id}" aria-label="Edit routine">✎</button>
      <button type="button" class="routine-delete" data-id="${routine.id}" aria-label="Delete routine">✕</button>
    </li>
  `;
}

/** Renders the routines list into both places it's shown: the popup sheet
 *  (reached via "Start Workout" → "Select Routine") and the inline Routines
 *  section on the Lift tab, which share the same markup/behavior. */
function renderRoutinesList() {
  $('routinesEmpty').hidden = routines.length > 0;
  $('routinesList').innerHTML = routines.map(routineRowHTML).join('');
  $('routinesTabEmpty').hidden = routines.length > 0;
  $('routinesTabList').innerHTML = routines.map(routineRowHTML).join('');
}

function openRoutinesSheet() {
  renderRoutinesList();
  $('scrim').hidden = false;
  $('routinesSheet').hidden = false;
  $('routinesSheet').scrollTop = 0;
}

function closeRoutinesSheet() {
  $('scrim').hidden = true;
  $('routinesSheet').hidden = true;
}

$('routinesClose').addEventListener('click', closeRoutinesSheet);

$('routinesList').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.routine-edit');
  if (editBtn) {
    const routine = routines.find((r) => r.id === editBtn.dataset.id);
    if (!routine) return;
    closeRoutinesSheet();
    openRoutineBuilderSheet(routine.exerciseIds, routine);
    return;
  }
  const deleteBtn = e.target.closest('.routine-delete');
  if (deleteBtn) {
    if (!confirm('Delete this routine?')) return;
    deleteRoutine(deleteBtn.dataset.id);
    routines = loadRoutines();
    renderRoutinesList();
    toast('Routine deleted');
    return;
  }
  const item = e.target.closest('.routine-item');
  if (!item) return;
  const routine = routines.find((r) => r.id === item.dataset.id);
  if (!routine) return;
  closeRoutinesSheet();
  openLiveWorkoutSheet(routine.exerciseIds);
});

$('addRoutineBtn').addEventListener('click', () => {
  closeRoutinesSheet();
  openRoutineBuilderSheet();
});

$('routinesTabList').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.routine-edit');
  if (editBtn) {
    const routine = routines.find((r) => r.id === editBtn.dataset.id);
    if (!routine) return;
    openRoutineBuilderSheet(routine.exerciseIds, routine);
    return;
  }
  const deleteBtn = e.target.closest('.routine-delete');
  if (deleteBtn) {
    if (!confirm('Delete this routine?')) return;
    deleteRoutine(deleteBtn.dataset.id);
    routines = loadRoutines();
    renderRoutinesList();
    toast('Routine deleted');
    return;
  }
  const item = e.target.closest('.routine-item');
  if (!item) return;
  const routine = routines.find((r) => r.id === item.dataset.id);
  if (!routine) return;
  if (liveSession) { toast('Finish or cancel your live workout first'); return; }
  openLiveWorkoutSheet(routine.exerciseIds);
});

$('addRoutineTabBtn').addEventListener('click', () => openRoutineBuilderSheet());

/* ------------------------------------------------------- routine builder */

function renderRoutinePickerChips() {
  $('routinePickerChips').innerHTML = MUSCLES.map((m) => `<button type="button" class="chip" data-muscle="${m}">${MUSCLE_LABEL[m]}</button>`).join('');
}

/** Renders the routine builder's picked-exercise list. Each row is
 *  long-press draggable to reorder (see the pointer handlers below), and
 *  carries a swap button that lets the picker below replace just that
 *  slot's exercise in place instead of removing and re-adding it (which
 *  would lose its position in the order). */
function renderRoutineSelectedList() {
  $('routineSelectedEmpty').hidden = routineSelectedIds.length > 0;
  $('routineSelectedList').innerHTML = routineSelectedIds.map((id, idx) => {
    const ex = findExercise(id);
    if (!ex) return '';
    return `
      <div class="routine-selected-item${idx === swappingIndex ? ' swapping' : ''}" data-id="${id}">
        <span class="routine-drag-handle" aria-hidden="true">⠿</span>
        <div class="routine-selected-info">
          <div class="wo-exercise-name">${escapeHTML(ex.name)}</div>
          <div class="wo-exercise-meta">${escapeHTML(exerciseMetaText(ex))}</div>
        </div>
        <button type="button" class="routine-selected-swap" data-id="${id}" aria-label="Swap exercise">${swapIconSVG()}</button>
        <button type="button" class="routine-selected-remove" data-id="${id}" aria-label="Remove exercise">✕</button>
      </div>
    `;
  }).join('');
}

function renderRoutinePickerResults() {
  const q = $('routinePickerSearch').value;
  const muscle = $('routinePickerChips').querySelector('.chip.active')?.dataset.muscle || '';
  const results = searchExercises(q, muscle, allExercises());
  $('routinePickerResults').innerHTML = results.length
    ? results.map((e) => `
      <button type="button" class="wo-picker-result${routineSelectedIds.includes(e.id) ? ' selected' : ''}" data-id="${e.id}">
        <span>${escapeHTML(e.name)}</span>
        <span class="wo-picker-result-meta">${routineSelectedIds.includes(e.id) ? '✓ added' : escapeHTML(e.equipment)}</span>
      </button>
    `).join('')
    : '<p class="empty">No matching exercises.</p>';
}

/* ------------------------------------------ routine builder: new exercise */

function renderRoutineNewExMuscleChips() {
  $('routineNewExMuscles').innerHTML = MUSCLES.map((m) => `<button type="button" class="chip" data-muscle="${m}">${MUSCLE_LABEL[m]}</button>`).join('');
}

function resetRoutineNewExerciseForm() {
  $('routineNewExName').value = '';
  $('routineNewExEquipment').innerHTML = EQUIPMENT.map((eq) => `<option value="${eq}">${eq}</option>`).join('');
  renderRoutineNewExMuscleChips();
}

function openRoutineNewExerciseForm() {
  resetRoutineNewExerciseForm();
  $('routineNewExerciseForm').hidden = false;
  $('routinePickerResults').hidden = true;
  $('routineNewExerciseBtn').hidden = true;
  $('routineBuilderActions').hidden = true;
  $('routineNewExName').focus();
}

function closeRoutineNewExerciseForm() {
  $('routineNewExerciseForm').hidden = true;
  $('routinePickerResults').hidden = false;
  $('routineNewExerciseBtn').hidden = false;
  $('routineBuilderActions').hidden = false;
}

$('routineNewExerciseBtn').addEventListener('click', openRoutineNewExerciseForm);
$('routineNewExCancel').addEventListener('click', closeRoutineNewExerciseForm);

$('routineNewExMuscles').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  chip.classList.toggle('active');
});

$('routineNewExSave').addEventListener('click', () => {
  const name = $('routineNewExName').value.trim();
  const equipment = $('routineNewExEquipment').value;
  const muscles = [...$('routineNewExMuscles').querySelectorAll('.chip.active')].map((c) => c.dataset.muscle);
  if (!name) { toast('Enter an exercise name'); return; }
  if (muscles.length === 0) { toast('Pick at least one body part'); return; }
  addCustomExercise({ name, equipment, muscles });
  customExercises = loadCustomExercises();
  closeRoutineNewExerciseForm();
  renderRoutinePickerResults();
  toast('Exercise added');
});

/** Opens the routine builder blank or pre-seeded with `exerciseIds` (used
 *  by "Save as Routine" on the finish-workout summary), or in edit mode
 *  for an existing routine when `editingRoutine` is passed (its own
 *  exerciseIds are what should be passed as `exerciseIds` too). */
function openRoutineBuilderSheet(exerciseIds = [], editingRoutine = null) {
  routineSelectedIds = [...new Set(exerciseIds)];
  editingRoutineId = editingRoutine?.id ?? null;
  swappingIndex = null;
  $('routineBuilderTitle').textContent = editingRoutine ? 'Edit Routine' : 'New Routine';
  $('routineSave').textContent = editingRoutine ? 'Save changes' : 'Save routine';
  $('routineName').value = editingRoutine?.name ?? '';
  $('routinePickerSearch').value = '';
  $('routinePickerHint').hidden = true;
  renderRoutinePickerChips();
  renderRoutineSelectedList();
  renderRoutinePickerResults();
  closeRoutineNewExerciseForm();
  $('scrim').hidden = false;
  $('routineBuilderSheet').hidden = false;
  $('routineBuilderSheet').scrollTop = 0;
}

function closeRoutineBuilderSheet() {
  cancelRoutineDrag();
  editingRoutineId = null;
  swappingIndex = null;
  $('scrim').hidden = true;
  $('routineBuilderSheet').hidden = true;
}

$('routineCancel').addEventListener('click', closeRoutineBuilderSheet);

$('routinePickerChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const wasActive = chip.classList.contains('active');
  $('routinePickerChips').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  if (!wasActive) chip.classList.add('active');
  renderRoutinePickerResults();
});

$('routinePickerSearch').addEventListener('input', renderRoutinePickerResults);

$('routinePickerResults').addEventListener('click', (e) => {
  const btn = e.target.closest('.wo-picker-result');
  if (!btn) return;
  const id = btn.dataset.id;
  if (swappingIndex != null) {
    if (routineSelectedIds.includes(id)) { toast('Already in this routine'); return; }
    routineSelectedIds[swappingIndex] = id;
    swappingIndex = null;
    $('routinePickerHint').hidden = true;
    renderRoutineSelectedList();
    renderRoutinePickerResults();
    return;
  }
  const idx = routineSelectedIds.indexOf(id);
  if (idx === -1) routineSelectedIds.push(id); else routineSelectedIds.splice(idx, 1);
  renderRoutineSelectedList();
  renderRoutinePickerResults();
});

$('routineSelectedList').addEventListener('click', (e) => {
  const swapBtn = e.target.closest('.routine-selected-swap');
  if (swapBtn) {
    const idx = routineSelectedIds.indexOf(swapBtn.dataset.id);
    if (idx === -1) return;
    swappingIndex = idx;
    const ex = findExercise(swapBtn.dataset.id);
    $('routinePickerHint').textContent = `Tap an exercise below to replace "${ex?.name ?? 'this exercise'}"`;
    $('routinePickerHint').hidden = false;
    renderRoutineSelectedList();
    $('routinePickerSearch').focus();
    return;
  }
  const removeBtn = e.target.closest('.routine-selected-remove');
  if (!removeBtn) return;
  routineSelectedIds = routineSelectedIds.filter((id) => id !== removeBtn.dataset.id);
  if (swappingIndex != null) { swappingIndex = null; $('routinePickerHint').hidden = true; }
  renderRoutineSelectedList();
  renderRoutinePickerResults();
});

/** Long-press-and-drag reordering for the routine builder's selected-
 *  exercise list, via Pointer Events (works for touch and mouse alike,
 *  unlike HTML5 drag-and-drop which mobile Safari doesn't support). A
 *  350ms hold confirms the drag is intentional rather than a scroll/tap;
 *  each time the pointer crosses into a sibling row, that row swaps
 *  places with the dragged one and the list re-renders around it. */
const ROUTINE_DRAG_HOLD_MS = 350;
const ROUTINE_DRAG_CANCEL_PX = 10;

function cancelRoutineDrag() {
  if (routineDrag?.longPressTimer) clearTimeout(routineDrag.longPressTimer);
  if (routineDrag?.dragging) {
    $('routineSelectedList').querySelectorAll('.routine-selected-item.dragging')
      .forEach((el) => el.classList.remove('dragging'));
  }
  routineDrag = null;
}

$('routineSelectedList').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; // remove/swap buttons behave normally
  const item = e.target.closest('.routine-selected-item');
  if (!item) return;
  const id = item.dataset.id;
  const pointerId = e.pointerId;
  const longPressTimer = setTimeout(() => {
    if (!routineDrag || routineDrag.id !== id) return;
    routineDrag.dragging = true;
    const el = $('routineSelectedList').querySelector(`.routine-selected-item[data-id="${CSS.escape(id)}"]`);
    el?.classList.add('dragging');
    el?.setPointerCapture(pointerId);
  }, ROUTINE_DRAG_HOLD_MS);
  routineDrag = { id, pointerId, longPressTimer, startX: e.clientX, startY: e.clientY, dragging: false };
});

$('routineSelectedList').addEventListener('pointermove', (e) => {
  if (!routineDrag || routineDrag.pointerId !== e.pointerId) return;
  if (!routineDrag.dragging) {
    const dx = Math.abs(e.clientX - routineDrag.startX);
    const dy = Math.abs(e.clientY - routineDrag.startY);
    if (dx > ROUTINE_DRAG_CANCEL_PX || dy > ROUTINE_DRAG_CANCEL_PX) cancelRoutineDrag();
    return;
  }
  e.preventDefault();
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.routine-selected-item');
  if (!target || target.dataset.id === routineDrag.id) return;
  const fromIdx = routineSelectedIds.indexOf(routineDrag.id);
  const toIdx = routineSelectedIds.indexOf(target.dataset.id);
  if (fromIdx === -1 || toIdx === -1) return;
  routineSelectedIds.splice(fromIdx, 1);
  routineSelectedIds.splice(toIdx, 0, routineDrag.id);
  renderRoutineSelectedList();
  const revived = $('routineSelectedList').querySelector(`.routine-selected-item[data-id="${CSS.escape(routineDrag.id)}"]`);
  revived?.classList.add('dragging');
  revived?.setPointerCapture(routineDrag.pointerId);
});

$('routineSelectedList').addEventListener('pointerup', cancelRoutineDrag);
$('routineSelectedList').addEventListener('pointercancel', cancelRoutineDrag);

$('routineForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('routineName').value.trim();
  if (!name) { toast('Enter a routine name'); return; }
  if (routineSelectedIds.length === 0) { toast('Add at least one exercise'); return; }
  if (editingRoutineId) {
    updateRoutine(editingRoutineId, { name, exerciseIds: routineSelectedIds });
  } else {
    addRoutine({ name, exerciseIds: routineSelectedIds });
  }
  routines = loadRoutines();
  renderRoutinesList();
  const wasEditing = Boolean(editingRoutineId);
  closeRoutineBuilderSheet();
  toast(wasEditing ? 'Routine updated' : 'Routine saved');
});

/** @param {ReturnType<typeof newPRsInWorkout>} [newPRs] shown as a
 *  celebratory banner above the duration when non-empty. */
function openWorkoutSummarySheet(workout, durationMs, newPRs = []) {
  lastFinishedWorkout = workout;
  lastFinishedDurationMs = durationMs;
  lastFinishedNewPRs = newPRs;
  $('summaryPRBanner').hidden = newPRs.length === 0;
  $('summaryPRBanner').innerHTML = newPRs.length === 0 ? '' : [
    `<div class="pr-banner-title">🎉 New Personal Record${newPRs.length > 1 ? 's' : ''}!</div>`,
    ...newPRs.map((p) => `<div class="pr-banner-item">${escapeHTML(p.name)}: <strong>${p.weight}kg</strong> <span class="pr-banner-delta">(+${Math.round((p.weight - p.previousWeight) * 10) / 10}kg)</span></div>`),
  ].join('');
  $('summaryDuration').textContent = fmtElapsed(durationMs);
  const rows = workoutSummaryByExercise(workout, allExercises(), bodyweightKg());
  $('summaryExercises').innerHTML = rows.length
    ? rows.map((r) => `
      <div class="summary-exercise-row">
        <div class="summary-exercise-name">${escapeHTML(r.name)}</div>
        <div class="summary-exercise-stats mono">${r.setCount} sets · ${r.totalReps} reps · ${r.volume}kg volume</div>
      </div>
    `).join('')
    : '<p class="empty">No working sets logged.</p>';
  $('scrim').hidden = false;
  $('workoutSummarySheet').hidden = false;
  $('workoutSummarySheet').scrollTop = 0;
}

$('summarySaveRoutine').addEventListener('click', () => {
  $('workoutSummarySheet').hidden = true;
  const ids = (lastFinishedWorkout?.exercises || []).map((ex) => ex.exerciseId);
  openRoutineBuilderSheet(ids);
});

/** Renders the same stats as the summary sheet into a transparent PNG,
 *  then hands it to the OS share sheet (so Instagram Stories shows up as
 *  a direct target, same as Strava's own post-activity share) - falling
 *  back to a plain file download wherever navigator.share doesn't support
 *  image files (desktop browsers, mainly). */
$('summaryShare').addEventListener('click', async () => {
  if (!lastFinishedWorkout) return;
  const btn = $('summaryShare');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const exerciseRows = workoutSummaryByExercise(lastFinishedWorkout, allExercises(), bodyweightKg());
    const totalVolume = workoutVolume(lastFinishedWorkout, allExercises(), bodyweightKg());
    const blob = await renderWorkoutShareCard({
      workoutName: lastFinishedWorkout.name || null,
      dateLabel: fmtDateLong(lastFinishedWorkout.date),
      durationMs: lastFinishedDurationMs,
      totalVolume,
      exerciseRows,
      newPRs: lastFinishedNewPRs,
    });
    const file = new File([blob], `hybrd-workout-${lastFinishedWorkout.date}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Workout complete' });
    } else {
      downloadFile(file.name, blob, 'image/png');
      toast('Image saved - share it from your Photos/Downloads');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') { // the user cancelling the native share sheet isn't a failure
      console.error('Failed to create share image', err);
      toast('Could not create the share image');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

function finishLiveWorkout(data) {
  const durationMs = Date.now() - new Date(liveSession.startedAt).getTime();
  const cleaned = {
    ...data,
    exercises: data.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map(({ done, ...rest }) => rest),
    })),
  };
  const saved = addWorkout(cleaned);
  workouts = loadWorkouts();
  const newPRs = newPRsInWorkout(workouts, saved, allExercises(), bodyweightKg());
  syncWorkoutToGoogle(saved);
  discardLiveWorkout();
  renderAll();
  openWorkoutSummarySheet(saved, durationMs, newPRs);
}

/** Silently resumes a live session left running in localStorage (e.g. the
 *  PWA was backgrounded/killed mid-workout) - repopulates the sheet's DOM
 *  and timer but only shows the mini-bar, not the full sheet. */
function resumeLiveWorkoutIfAny() {
  const saved = loadLiveWorkout();
  if (!saved) return;
  workoutEditingId = null;
  pairingSourceBlock = null;
  liveSession = { startedAt: saved.startedAt };
  setWorkoutSheetLiveMode(true);
  $('woDate').value = saved.date || todayIso();
  $('woName').value = saved.name || '';
  $('woNotes').value = saved.notes || '';
  $('woExerciseList').innerHTML = (saved.exercises || [])
    .map((ex) => exerciseBlockHTML(ex.exerciseId, ex.sets && ex.sets.length ? ex.sets : [{}], ex.supersetId, ex.brand))
    .join('');
  regroupSupersets();
  $('woPicker').hidden = true;
  $('woDelete').hidden = true;
  startLiveTimer();
  showLiveMiniBar();
}

$('startWorkoutBtn').addEventListener('click', () => startOrOpenWorkoutFor(todayIso()));
$('liveMiniBar').addEventListener('click', reopenLiveWorkoutSheet);

$('woCancel').addEventListener('click', () => {
  if (workoutSheetMode === 'live') {
    if (!confirm('Cancel this workout? Your progress will be lost.')) return;
    discardLiveWorkout();
    toast('Workout cancelled');
    return;
  }
  closeWorkoutSheet();
});

$('workoutForm').addEventListener('change', (e) => {
  if (e.target.matches('#woDate, #woName, #woNotes, .wo-set-weight, .wo-set-reps')) syncLiveWorkout();
});

$('workoutForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = readWorkoutForm();
  if (data.exercises.length === 0) {
    toast('Add at least one exercise');
    return;
  }
  if (workoutSheetMode === 'live') {
    finishLiveWorkout(data);
    return;
  }
  if (workoutEditingId) {
    const saved = updateWorkout(workoutEditingId, data);
    toast('Workout updated');
    workouts = loadWorkouts();
    if (saved) syncWorkoutToGoogle(saved);
  } else {
    const saved = addWorkout(data);
    workouts = loadWorkouts();
    const newPRs = newPRsInWorkout(workouts, saved, allExercises(), bodyweightKg());
    if (newPRs.length > 0) toast(newPRToastMessage(newPRs), 3400);
    else toast('Workout saved');
    syncWorkoutToGoogle(saved);
  }
  closeWorkoutSheet();
  renderAll();
});

$('summaryDone').addEventListener('click', () => {
  $('scrim').hidden = true;
  $('workoutSummarySheet').hidden = true;
});

// Backgrounding the PWA (phone call, screen lock, switching apps) or
// reloading/closing the tab fires one of these before anything is torn
// down - a more reliable persistence point than each field's 'change'
// event alone for whatever was just typed but not yet blurred.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveLiveWorkoutState();
});
window.addEventListener('pagehide', () => saveLiveWorkoutState());

$('woDelete').addEventListener('click', () => {
  if (!workoutEditingId) return;
  if (!confirm('Delete this workout? This cannot be undone.')) return;
  const toDelete = workouts.find((w) => w.id === workoutEditingId);
  deleteWorkout(workoutEditingId);
  workouts = loadWorkouts();
  if (toDelete) deleteWorkoutFromGoogle(toDelete);
  closeWorkoutSheet();
  renderAll();
  toast('Workout deleted');
});

/** Repaints the stat grid and both progress charts for the currently-open
 *  exercise sheet, respecting the selected brand filter (if any). Split out
 *  from openExerciseSheet so the filter's change handler can re-render
 *  without rebuilding the whole sheet (name, diagram, filter options). */
function renderExerciseSheetStats() {
  const ex = findExercise(exerciseSheetId);
  if (!ex) return;
  const brand = exDetailBrand || null;
  const pr = personalRecords(workouts, exerciseSheetId, allExercises(), bodyweightKg(), brand);
  $('exDetailStatGrid').innerHTML = [
    [pr ? `${pr.maxWeight} kg` : '—', 'Best weight'],
    [pr ? `${pr.best1RM} kg` : '—', 'Est. 1RM'],
    [pr ? String(pr.timesLogged) : '0', 'Times logged'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');
  $('exDetailChart').innerHTML = exerciseProgressSVG(exerciseProgress(workouts, exerciseSheetId, allExercises(), bodyweightKg(), brand));
  $('exDetailVolumeChart').innerHTML = exerciseVolumeSVG(exerciseVolumeProgress(workouts, exerciseSheetId, allExercises(), bodyweightKg(), brand));
}

function openExerciseSheet(exerciseId) {
  const ex = findExercise(exerciseId);
  if (!ex) return;
  exerciseSheetId = exerciseId;
  exDetailBrand = '';
  // Not in the built-in static library means the user created it
  // themselves, and can edit/delete it.
  const isCustom = isCustomExercise(exerciseId);
  $('exDetailEditCustom').hidden = !isCustom;
  $('exDetailDeleteCustom').hidden = !isCustom;
  $('exDetailCustomBadge').hidden = !isCustom;
  closeExEditForm();
  $('exDetailName').textContent = ex.name;
  $('exDetailMeta').textContent = exerciseMetaText(ex);
  $('exDetailDiagram').innerHTML = muscleDiagramHTML(ex.muscles);
  // Brand filter only makes sense for Machine/Cable equipment, and only
  // once there's actually more than one brand's worth of data to filter.
  const loggedBrands = (ex.equipment === 'Machine' || ex.equipment === 'Cable')
    ? loggedBrandsForExercise(workouts, exerciseId)
    : [];
  $('exDetailBrandFilter').hidden = loggedBrands.length === 0;
  $('exDetailBrandFilter').innerHTML = ['<option value="">All brands</option>']
    .concat(loggedBrands.map((b) => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`))
    .join('');
  $('exDetailBrandFilter').value = '';
  renderExerciseSheetStats();
  $('scrim').hidden = false;
  $('exerciseSheet').hidden = false;
  $('exerciseSheet').scrollTop = 0;
}

$('exDetailBrandFilter').addEventListener('change', () => {
  exDetailBrand = $('exDetailBrandFilter').value;
  renderExerciseSheetStats();
});

/* -------------------------------------------------- edit custom exercise */

function openExEditForm() {
  const ex = findExercise(exerciseSheetId);
  if (!ex) return;
  $('exEditName').value = ex.name;
  $('exEditEquipment').innerHTML = EQUIPMENT.map((eq) => `<option value="${eq}"${eq === ex.equipment ? ' selected' : ''}>${eq}</option>`).join('');
  $('exEditMuscles').innerHTML = MUSCLES.map((m) => `<button type="button" class="chip${ex.muscles.includes(m) ? ' active' : ''}" data-muscle="${m}">${MUSCLE_LABEL[m]}</button>`).join('');
  $('exDetailViewMode').hidden = true;
  $('exDetailEditForm').hidden = false;
}

function closeExEditForm() {
  $('exDetailEditForm').hidden = true;
  $('exDetailViewMode').hidden = false;
}

$('exDetailEditCustom').addEventListener('click', openExEditForm);
$('exEditCancel').addEventListener('click', closeExEditForm);

$('exEditMuscles').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  chip.classList.toggle('active');
});

$('exEditSave').addEventListener('click', () => {
  if (!exerciseSheetId) return;
  const name = $('exEditName').value.trim();
  const equipment = $('exEditEquipment').value;
  const muscles = [...$('exEditMuscles').querySelectorAll('.chip.active')].map((c) => c.dataset.muscle);
  if (!name) { toast('Enter an exercise name'); return; }
  if (muscles.length === 0) { toast('Pick at least one body part'); return; }
  updateCustomExercise(exerciseSheetId, { name, equipment, muscles });
  customExercises = loadCustomExercises();
  openExerciseSheet(exerciseSheetId);
  renderWorkoutTab();
  toast('Exercise updated');
});

function closeExerciseSheet() {
  exerciseSheetId = null;
  $('scrim').hidden = true;
  $('exerciseSheet').hidden = true;
}

$('exDetailClose').addEventListener('click', closeExerciseSheet);

$('exDetailDeleteCustom').addEventListener('click', () => {
  if (!exerciseSheetId) return;
  if (!confirm('Delete this custom exercise? Past workouts that used it will keep their logged sets but no longer show its name.')) return;
  deleteCustomExercise(exerciseSheetId);
  customExercises = loadCustomExercises();
  closeExerciseSheet();
  renderWorkoutTab();
  toast('Exercise deleted');
});

function renderExerciseFilterOptions() {
  const options = ['<option value="">All body parts</option>', '<option value="custom">Custom</option>']
    .concat(MUSCLES.map((m) => `<option value="${m}">${MUSCLE_LABEL[m]}</option>`));
  $('exerciseFilterMuscle').innerHTML = options.join('');
  $('exerciseFilterMuscle').value = exerciseFilterMuscle;
}

/** Card list ids for the Exercises section. With no search text, this stays
 *  scoped to exercises you've actually logged (the "your history" view it's
 *  always been); typing a search widens the pool to the whole library
 *  (built-in + custom) so you can look up and open an exercise you haven't
 *  done yet - its card just shows "No sets logged yet" like a fresh custom
 *  exercise would. `exerciseFilterMuscle` doubles as a body-part filter and
 *  a special "custom" filter (own exercises only) - not a real muscle id,
 *  so it's stripped out before being passed to the muscle-matching helpers
 *  and applied as its own pass afterwards. */
function renderExerciseSummaries() {
  renderExerciseFilterOptions();
  const q = exerciseSearchQuery.trim();
  const customOnly = exerciseFilterMuscle === 'custom';
  const muscle = customOnly ? '' : exerciseFilterMuscle;
  let ids = q
    ? searchExercises(q, muscle, allExercises()).map((e) => e.id)
    : loggedExerciseIds(workouts).filter((id) => {
      const ex = findExercise(id);
      if (!ex) return false;
      if (muscle && !ex.muscles.includes(muscle)) return false;
      return true;
    });
  if (customOnly) ids = ids.filter(isCustomExercise);
  $('exerciseSummaryEmpty').hidden = ids.length > 0;
  $('exerciseSummaryEmpty').textContent = !exerciseFilterMuscle && !q
    ? 'No workouts logged yet — the exercises you log will show up here with their progress.'
    : customOnly && q
      ? 'No custom exercises match your search.'
      : customOnly
        ? 'No logged custom exercises yet.'
        : exerciseFilterMuscle && q
          ? 'No exercises match this body part and search.'
          : exerciseFilterMuscle
            ? 'No logged exercises work this body part yet.'
            : 'No exercises match your search.';
  $('exerciseSummaryList').innerHTML = ids.map((id) => {
    const ex = findExercise(id);
    if (!ex) return '';
    const pr = personalRecords(workouts, id, allExercises(), bodyweightKg());
    return `
      <button type="button" class="exercise-summary-card" data-id="${id}">
        ${muscleDiagramHTML(ex.muscles)}
        <div class="exercise-summary-info">
          <div class="exercise-summary-name-row">
            <div class="exercise-summary-name">${escapeHTML(ex.name)}</div>
            ${isCustomExercise(id) ? '<span class="badge">Custom</span>' : ''}
          </div>
          <div class="exercise-summary-meta">${escapeHTML(exerciseMetaText(ex))}</div>
          <div class="exercise-summary-pr mono">${pr ? `PR ${pr.maxWeight}kg` : 'No sets logged yet'}</div>
        </div>
      </button>
    `;
  }).join('');
}

$('exerciseSummaryList').addEventListener('click', (e) => {
  const card = e.target.closest('.exercise-summary-card');
  if (card) openExerciseSheet(card.dataset.id);
});

$('exerciseFilterMuscle').addEventListener('change', () => {
  exerciseFilterMuscle = $('exerciseFilterMuscle').value;
  renderExerciseSummaries();
});

$('exerciseSearchInput').addEventListener('input', () => {
  exerciseSearchQuery = $('exerciseSearchInput').value;
  renderExerciseSummaries();
});

function renderWorkoutHistory() {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  $('workoutHistoryEmpty').hidden = sorted.length > 0;
  $('workoutHistoryList').innerHTML = sorted.map((w) => {
    const exCount = (w.exercises || []).length;
    return `
      <li>
        <button type="button" class="history-item" data-id="${w.id}">
          <div class="history-top">
            <span class="history-date">${fmtDateLong(w.date)}</span>
            ${w.name ? `<span class="pill pill-type">${escapeHTML(w.name)}</span>` : ''}
          </div>
          <div class="history-meta">
            <span>${exCount} exercise${exCount === 1 ? '' : 's'}</span>
            <span class="mono">${workoutVolume(w, allExercises(), bodyweightKg())}kg volume</span>
          </div>
          ${w.notes ? `<div class="history-notes">${escapeHTML(w.notes)}</div>` : ''}
        </button>
      </li>
    `;
  }).join('');
}

$('workoutHistoryList').addEventListener('click', (e) => {
  const btn = e.target.closest('.history-item');
  if (!btn) return;
  const w = workouts.find((x) => x.id === btn.dataset.id);
  if (w) openWorkoutEditSheet(w);
});

function renderWorkoutTab() {
  const daysSince = daysSinceLastWorkout(workouts);
  $('workoutStatGrid').innerHTML = [
    [String(workouts.length), 'Workouts logged'],
    [`${volumeSince(workouts, 7, todayIso(), allExercises(), bodyweightKg())} kg`, 'Volume this week'],
    [daysSince != null ? String(daysSince) : '—', 'Days since last workout'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono stat-value-accent">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  renderMuscleRadar();
  renderExerciseSummaries();
  renderWorkoutHistory();
  renderRoutinesList();
}

/** Redraws the radar chart and, if a label is expanded, its breakdown panel below it. */
function renderMuscleRadar() {
  $('muscleChartWrap').innerHTML = muscleRadarSVG(
    muscleSetBreakdown(workouts, muscleRange, todayIso(), allExercises()),
    expandedRadarGroup,
  );
  renderMuscleGroupDetail();
}

/** The granular body parts (e.g. Front/Lateral/Rear Delts) that roll up into
 *  whichever radar group's label is currently expanded, each shown as a
 *  share of that group's own total - not the chart's overall total - so a
 *  tapped group's sub-parts read as one 100% breakdown of it. */
function renderMuscleGroupDetail() {
  const panel = $('muscleGroupDetail');
  if (!expandedRadarGroup) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const detailed = muscleSetBreakdownDetailed(workouts, muscleRange, todayIso(), allExercises());
  const rows = detailed.filter((r) => RADAR_GROUP_FOR[r.muscle] === expandedRadarGroup);
  const groupTotal = rows.reduce((sum, r) => sum + r.sets, 0);
  panel.hidden = false;
  panel.innerHTML = `
    <div class="muscle-group-detail-title">${RADAR_GROUP_LABEL[expandedRadarGroup]} breakdown</div>
    ${rows.map((r) => {
      const pct = groupTotal ? Math.round((r.sets / groupTotal) * 100) : 0;
      return `
        <div class="muscle-group-detail-row">
          <span class="muscle-group-detail-name">${MUSCLE_LABEL[r.muscle]}</span>
          <div class="muscle-group-detail-bar"><div class="muscle-group-detail-bar-fill" style="width:${pct}%"></div></div>
          <span class="muscle-group-detail-pct mono">${pct}%</span>
        </div>
      `;
    }).join('')}
  `;
}

$('muscleScope').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  muscleRange = btn.dataset.scope;
  $('muscleScope').querySelectorAll('.scope').forEach((b) => {
    b.setAttribute('aria-selected', String(b === btn));
  });
  renderMuscleRadar();
});

// Tapping a radar label expands (or, tapped again, collapses) that group's
// breakdown into its own granular body parts, e.g. Shoulders -> Front/
// Lateral/Rear Delts.
$('muscleChartWrap').addEventListener('click', (e) => {
  const target = e.target.closest('[data-group]');
  if (!target) return;
  const group = target.dataset.group;
  expandedRadarGroup = expandedRadarGroup === group ? null : group;
  renderMuscleRadar();
});

/* --------------------------------------------------------------- ZONES */

function renderZoneRow(z) {
  return `
    <div class="zone-row ${z.target ? 'is-target' : ''}">
      <div>
        <div class="zone-name">${z.name}</div>
        <div class="zone-pct">${z.low}–${z.high}%</div>
      </div>
      <div class="zone-bpm mono">${z.bpmLow}–${z.bpmHigh}</div>
      <div>${z.target ? '<span class="badge">target</span>' : ''}</div>
    </div>
  `;
}

function renderZones() {
  $('lthrZoneTable').innerHTML = lthrZoneTable(settings).map(renderZoneRow).join('');
  $('rhrZoneTable').innerHTML = rhrZoneTable(settings).map(renderZoneRow).join('');
  $('lthrPrimaryBadge').hidden = settings.primaryZoneModel !== 'lthr';
  $('rhrPrimaryBadge').hidden = settings.primaryZoneModel !== 'rhr';
}

/* ------------------------------------------------------- GOOGLE CALENDAR */

// Set when an automatic (silent) sync attempt couldn't get a valid token -
// surfaced in Settings as "reconnect needed" instead of the steady-state
// "Connected", and cleared again by any successful sync or explicit connect.
let gcalNeedsReconnect = false;

/** Runs `fn(token, calendarId)` against the app's dedicated Google Calendar
 *  if sync is enabled and a token can be obtained silently (this never pops
 *  a consent screen itself - only the Connect button's click handler does
 *  that). Caches the calendar id back into settings the first time it
 *  differs from what was already cached. Every call site below is
 *  fire-and-forget: a save always succeeds locally regardless of whether
 *  the calendar push that follows it succeeds. */
async function withGoogleCalendar(fn) {
  const gc = settings.googleCalendar;
  if (!gc?.enabled || !gc?.clientId) return;
  try {
    const token = await gcalSilentToken(gc.clientId);
    if (!token) { gcalNeedsReconnect = true; renderGCalStatus(); return; }
    const calendarId = await getOrCreateCalendar(token, gc.calendarId);
    if (calendarId !== gc.calendarId) {
      settings = { ...settings, googleCalendar: { ...settings.googleCalendar, calendarId } };
      saveSettings(settings);
    }
    await fn(token, calendarId);
    gcalNeedsReconnect = false;
    renderGCalStatus();
  } catch (err) {
    console.error('Google Calendar sync failed', err);
  }
}

async function syncSessionToGoogle(session) {
  await withGoogleCalendar(async (token, calendarId) => {
    const eventId = await gcalUpsertEvent(token, calendarId, session.gcalEventId || null, sessionToGCalEvent(session));
    if (eventId !== session.gcalEventId) {
      updateSession(session.id, { gcalEventId: eventId });
      sessions = loadSessions();
    }
  });
}

async function deleteSessionFromGoogle(session) {
  if (!session.gcalEventId) return;
  await withGoogleCalendar(async (token, calendarId) => {
    await gcalDeleteEvent(token, calendarId, session.gcalEventId);
  });
}

async function syncWorkoutToGoogle(workout) {
  await withGoogleCalendar(async (token, calendarId) => {
    const event = workoutToGCalEvent(workout, allExercises(), bodyweightKg());
    const eventId = await gcalUpsertEvent(token, calendarId, workout.gcalEventId || null, event);
    if (eventId !== workout.gcalEventId) {
      updateWorkout(workout.id, { gcalEventId: eventId });
      workouts = loadWorkouts();
    }
  });
}

async function deleteWorkoutFromGoogle(workout) {
  if (!workout.gcalEventId) return;
  await withGoogleCalendar(async (token, calendarId) => {
    await gcalDeleteEvent(token, calendarId, workout.gcalEventId);
  });
}

async function syncAllToGoogle() {
  const reconnectedBefore = !gcalNeedsReconnect;
  for (const s of sessions) await syncSessionToGoogle(s);
  for (const w of workouts) await syncWorkoutToGoogle(w);
  if (gcalNeedsReconnect) toast('Reconnect needed to finish syncing');
  else if (reconnectedBefore) toast('Google Calendar sync complete');
}

function renderGCalStatus() {
  $('gcalClientId').value = settings.googleCalendar.clientId;
  const { enabled } = settings.googleCalendar;
  $('gcalDisconnect').hidden = !enabled;
  $('gcalSyncNow').hidden = !enabled;
  if (!enabled) {
    $('gcalStatus').textContent = 'Not connected.';
    $('gcalConnect').hidden = false;
  } else if (gcalNeedsReconnect) {
    $('gcalStatus').textContent = 'Sync paused - tap Connect to resume.';
    $('gcalConnect').hidden = false;
  } else {
    $('gcalStatus').textContent = `Connected - syncing to "${CALENDAR_NAME}".`;
    $('gcalConnect').hidden = true;
  }
}

$('gcalClientId').addEventListener('change', () => {
  settings = { ...settings, googleCalendar: { ...settings.googleCalendar, clientId: $('gcalClientId').value.trim() } };
  saveSettings(settings);
});

$('gcalConnect').addEventListener('click', async () => {
  const clientId = $('gcalClientId').value.trim();
  if (!clientId) { toast('Paste your Google OAuth Client ID first'); return; }
  try {
    const token = await gcalConnectFlow(clientId);
    const calendarId = await getOrCreateCalendar(token, settings.googleCalendar.calendarId);
    settings = { ...settings, googleCalendar: { clientId, calendarId, enabled: true } };
    saveSettings(settings);
    gcalNeedsReconnect = false;
    renderGCalStatus();
    toast('Connected - syncing your history now…');
    await syncAllToGoogle();
  } catch (err) {
    console.error('Google Calendar connect failed', err);
    toast('Could not connect to Google Calendar');
  }
});

$('gcalDisconnect').addEventListener('click', () => {
  if (!confirm('Disconnect Google Calendar? Already-synced events stay in your calendar - only future auto-sync stops.')) return;
  gcalClearToken();
  settings = { ...settings, googleCalendar: { ...settings.googleCalendar, enabled: false } };
  saveSettings(settings);
  gcalNeedsReconnect = false;
  renderGCalStatus();
  toast('Disconnected');
});

$('gcalSyncNow').addEventListener('click', async () => {
  toast('Syncing to Google Calendar…');
  await syncAllToGoogle();
});

/* ----------------------------------------------------------- INTERVALS.ICU */

// Set on a failed sync (e.g. a revoked/typo'd API key), cleared by the
// next successful one - same purpose as gcalNeedsReconnect above.
let intervalsNeedsReconnect = false;

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Imports every not-yet-seen run out of `activities` (deduped by
 *  intervalsActivityId), returning how many were added. A date that
 *  already has a manually-logged run (no intervalsActivityId of its own)
 *  is skipped entirely, never touched - a run the user typed in by hand
 *  is never silently duplicated, overwritten, or replaced by an imported
 *  one, even if intervals.icu also has an activity for that same day.
 *  `vo2maxByDate` (optional, date -> number) fills in the watch's own
 *  VO2max estimate for that day, if any - see fetchVo2maxByDate. */
function importNewIntervalsRunActivities(activities, vo2maxByDate = new Map()) {
  const existingIds = new Set(sessions.map((s) => s.intervalsActivityId).filter(Boolean));
  const manualDates = new Set(sessions.filter((s) => !s.intervalsActivityId).map((s) => s.date));
  let count = 0;
  for (const activity of activities) {
    if (!isIntervalsRunActivity(activity) || existingIds.has(activity.id)) continue;
    const mapped = intervalsActivityToSession(activity);
    if (manualDates.has(mapped.date)) continue;
    if (vo2maxByDate.has(mapped.date)) mapped.vo2max = vo2maxByDate.get(mapped.date);
    addSession(mapped);
    count += 1;
  }
  if (count > 0) sessions = loadSessions();
  return count;
}

/** Date -> VO2max map from intervals.icu's wellness log, covering the same
 *  window as a run sync - lets a newly-imported run come in pre-filled
 *  with the watch's own VO2max estimate for that day instead of leaving
 *  the user to type it into the edit sheet by hand. Best-effort: a
 *  failure here never blocks the run import itself, it just means those
 *  sessions come in without a VO2max reading, same as before this existed. */
async function fetchVo2maxByDate(athleteId, apiKey, oldestIso) {
  try {
    const history = await intervalsFetchWellnessHistory(athleteId, apiKey, oldestIso, todayIso());
    return new Map(history.filter((w) => w.vo2max != null).map((w) => [w.date, w.vo2max]));
  } catch (err) {
    console.error('intervals.icu VO2max wellness fetch failed', err);
    return new Map();
  }
}

/** Pulls new run activities from intervals.icu into local sessions. The
 *  first sync (no lastSyncedAt yet) backfills the last 90 days; every sync
 *  after that only asks for what's new. No OAuth here (see intervals.js) -
 *  a plain API-key GET, so unlike Strava/Google there's no token to
 *  refresh or redirect to handle, just "does the request succeed". */
async function syncIntervalsRuns({ silent = false } = {}) {
  const s = settings.intervals;
  if (!s?.enabled || !s?.athleteId || !s?.apiKey) return;
  let imported = null;
  let failure = null;
  try {
    const oldest = s.lastSyncedAt || isoDateDaysAgo(90);
    const activities = await intervalsListActivities(s.athleteId, s.apiKey, oldest);
    const vo2maxByDate = await fetchVo2maxByDate(s.athleteId, s.apiKey, oldest);
    imported = importNewIntervalsRunActivities(activities, vo2maxByDate);
    settings = { ...settings, intervals: { ...settings.intervals, lastSyncedAt: todayIso() } };
    saveSettings(settings);
    intervalsNeedsReconnect = false;
  } catch (err) {
    console.error('intervals.icu sync failed', err);
    intervalsNeedsReconnect = true;
    failure = err;
  }
  if (imported) renderAll();
  renderIntervalsStatus();
  if (silent) return;
  if (failure?.networkError) toast('Could not reach intervals.icu - check your connection', 3400);
  else if (imported == null) toast('Could not sync intervals.icu - check your Athlete ID and API Key');
  else if (imported > 0) toast(`Imported ${imported} run${imported === 1 ? '' : 's'} from intervals.icu`);
  else toast('No new runs to import');
}

/** Refreshes the cached resting HR / sleep shown as Dashboard stat tiles.
 *  Always silent (no toast, no reconnect-state changes) since it's a
 *  supplementary enrichment alongside the real sync above, not its own
 *  user-facing action - a failure here just means the tiles keep showing
 *  whatever was cached from the last successful check. */
async function syncIntervalsWellness() {
  const s = settings.intervals;
  if (!s?.enabled || !s?.athleteId || !s?.apiKey) return;
  try {
    const wellness = await intervalsFetchRecentWellness(s.athleteId, s.apiKey);
    settings = { ...settings, intervals: { ...settings.intervals, wellness } };
    saveSettings(settings);
    renderDashboard();
  } catch (err) {
    console.error('intervals.icu wellness sync failed', err);
  }
}

function renderIntervalsStatus() {
  $('intervalsAthleteId').value = settings.intervals.athleteId;
  $('intervalsApiKey').value = settings.intervals.apiKey;
  const { enabled } = settings.intervals;
  $('intervalsDisconnect').hidden = !enabled;
  $('intervalsSyncNow').hidden = !enabled;
  if (!enabled) {
    $('intervalsStatus').textContent = 'Not connected.';
    $('intervalsConnect').hidden = false;
  } else if (intervalsNeedsReconnect) {
    $('intervalsStatus').textContent = 'Sync failed - tap Connect to retry.';
    $('intervalsConnect').hidden = false;
  } else {
    $('intervalsStatus').textContent = 'Connected - importing your runs automatically.';
    $('intervalsConnect').hidden = true;
  }
}

$('intervalsAthleteId').addEventListener('change', () => {
  settings = { ...settings, intervals: { ...settings.intervals, athleteId: $('intervalsAthleteId').value.trim() } };
  saveSettings(settings);
});
$('intervalsApiKey').addEventListener('change', () => {
  settings = { ...settings, intervals: { ...settings.intervals, apiKey: $('intervalsApiKey').value.trim() } };
  saveSettings(settings);
});

$('intervalsConnect').addEventListener('click', async () => {
  const athleteId = $('intervalsAthleteId').value.trim();
  const apiKey = $('intervalsApiKey').value.trim();
  if (!athleteId || !apiKey) { toast('Fill in both the Athlete ID and API Key first'); return; }
  try {
    const activities = await intervalsListActivities(athleteId, apiKey, isoDateDaysAgo(90));
    const vo2maxByDate = await fetchVo2maxByDate(athleteId, apiKey, isoDateDaysAgo(90));
    settings = { ...settings, intervals: { athleteId, apiKey, enabled: true, lastSyncedAt: todayIso() } };
    saveSettings(settings);
    const imported = importNewIntervalsRunActivities(activities, vo2maxByDate);
    intervalsNeedsReconnect = false;
    renderAll();
    renderIntervalsStatus();
    syncIntervalsWellness();
    toast(imported > 0 ? `Connected - imported ${imported} run${imported === 1 ? '' : 's'}` : 'Connected - no runs to import yet');
  } catch (err) {
    console.error('intervals.icu connect failed', err);
    if (err.networkError) toast('Could not reach intervals.icu - check your connection', 3400);
    else if (err.status === 401 || err.status === 403) toast('Could not connect - check your Athlete ID and API Key');
    else toast(`Could not connect - intervals.icu error ${err.status ?? ''}`.trim());
  }
});

$('intervalsDisconnect').addEventListener('click', () => {
  if (!confirm('Disconnect intervals.icu? Runs already imported stay in your history - only future auto-import stops.')) return;
  intervalsNeedsReconnect = false;
  settings = { ...settings, intervals: { ...settings.intervals, enabled: false } };
  saveSettings(settings);
  renderIntervalsStatus();
  renderDashboard(); // drops the Resting HR/Sleep tiles immediately - switchView alone doesn't re-render
  toast('Disconnected');
});

$('intervalsSyncNow').addEventListener('click', () => { syncIntervalsRuns(); });

/* ------------------------------------------------------------- SETTINGS */

function renderSettingsForm() {
  $('sTheme').querySelectorAll('.scope').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.theme === settings.theme));
  });
  $('sName').value = settings.profile.name;
  $('sDob').value = settings.profile.dob;
  $('sHeightCm').value = settings.profile.heightCm ?? '';
  $('sWeightKg').value = settings.profile.weightKg ?? '';
  $('sBaselineVO2max').value = settings.baselineVO2max;
  $('sBaselineDate').value = settings.baselineDate;
  $('sDevice').value = settings.device;
  $('sRestingHR').value = settings.restingHR;
  $('sMaxHR').value = settings.maxHR;
  $('sLTHR').value = settings.lthr;
  $('sPrimaryModel').value = settings.primaryZoneModel;
  renderGCalStatus();
  renderIntervalsStatus();
}

$('sTheme').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  settings = { ...settings, theme: btn.dataset.theme };
  saveSettings(settings);
  applyTheme(settings.theme);
  renderSettingsForm();
});

$('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  settings = {
    theme: settings.theme,
    googleCalendar: settings.googleCalendar,
    intervals: settings.intervals,
    profile: {
      name: $('sName').value.trim(),
      dob: $('sDob').value,
      heightCm: numOrNull($('sHeightCm').value),
      weightKg: numOrNull($('sWeightKg').value),
    },
    baselineVO2max: Number($('sBaselineVO2max').value),
    baselineDate: $('sBaselineDate').value,
    device: $('sDevice').value.trim(),
    restingHR: Number($('sRestingHR').value),
    maxHR: Number($('sMaxHR').value),
    lthr: Number($('sLTHR').value),
    primaryZoneModel: $('sPrimaryModel').value,
  };
  saveSettings(settings);
  renderAll();
  markSaved($('settingsSaveBtn'), 'Settings Saved');
});

$('settingsForm').addEventListener('input', () => clearSaved($('settingsSaveBtn')));
$('settingsForm').addEventListener('change', () => clearSaved($('settingsSaveBtn')));

$('sExport').addEventListener('click', () => {
  downloadFile(`vo2max-export-${todayIso()}.json`, exportAll(), 'application/json');
});

$('sImport').addEventListener('click', () => $('sFile').click());
$('sFile').addEventListener('change', async () => {
  const file = $('sFile').files[0];
  if (!file) return;
  try {
    importAll(await file.text());
    settings = loadSettings();
    applyTheme(settings.theme);
    sessions = loadSessions();
    workouts = loadWorkouts();
    customExercises = loadCustomExercises();
    renderAll();
    clearSaved($('settingsSaveBtn'));
    toast('Data imported');
  } catch {
    toast('Import failed — invalid file');
  }
  $('sFile').value = '';
});

$('sReset').addEventListener('click', () => {
  if (!confirm('Reset all settings to defaults? Sessions are not affected.')) return;
  settings = resetSettings();
  applyTheme(settings.theme);
  renderAll();
  clearSaved($('settingsSaveBtn'));
  toast('Settings reset');
});

/* ------------------------------------------------------------------ boot */

function renderAll() {
  renderDashboard();
  renderHistory();
  renderCalendar();
  renderRunTab();
  renderWorkoutTab();
  renderZones();
  renderSettingsForm();
}

resetLogForm();
renderAll();
switchView('dashboard');
resumeLiveWorkoutIfAny();
if (settings.intervals.enabled) {
  syncIntervalsRuns({ silent: true });
  syncIntervalsWellness();
}

// The boot splash (index.html) has done its job now that the real UI is
// rendered - fade it out, then drop it from the DOM once the transition
// (see its CSS) finishes, rather than leaving an invisible-but-present
// full-viewport element sitting over everything.
const bootSplash = $('bootSplash');
if (bootSplash) {
  bootSplash.classList.add('hide');
  bootSplash.addEventListener('transitionend', () => bootSplash.remove(), { once: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
