import {
  loadSettings, saveSettings, resetSettings,
  loadSessions, addSession, updateSession, deleteSession,
  loadWorkouts, addWorkout, updateWorkout, deleteWorkout,
  loadCustomExercises, addCustomExercise, deleteCustomExercise,
  exportAll, importAll,
} from './store.js';
import { lthrZoneTable, rhrZoneTable, targetZone } from './zones.js';
import {
  todayIso,
  daysSinceLastSession, averageSessionHR, vo2maxSeries,
  mileageBuckets, totalMileage,
} from './block.js';
import {
  vo2maxTrendSVG, mileageBarChartSVG, exerciseProgressSVG, muscleRadarSVG,
} from './chart.js';
import { sessionToICS } from './ics.js';
import {
  EXERCISES, MUSCLES, MUSCLE_LABEL, EQUIPMENT, RADAR_GROUP_LABEL, RADAR_GROUP_FOR,
  exerciseById, searchExercises,
} from './exercises.js';
import { muscleDiagramHTML } from './muscleDiagram.js';
import {
  workoutVolume, lastPerformance, personalRecords, exerciseProgress,
  loggedExerciseIds, daysSinceLastWorkout, volumeSince,
  muscleSetBreakdown, muscleSetBreakdownDetailed,
} from './workout.js';
import { runIconSVG, dumbbellIconSVG } from './icons.js';

let settings = loadSettings();
let sessions = loadSessions();
let workouts = loadWorkouts();
let customExercises = loadCustomExercises();
let editingId = null;
let workoutEditingId = null;
let exerciseSheetId = null;
let mileageScope = 'week';
let muscleRange = 'week';
let expandedRadarGroup = null;

const $ = (id) => document.getElementById(id);

/** The built-in library plus the user's own custom exercises, for lookups
 *  and search — a workout can reference either. */
function allExercises() {
  return [...EXERCISES, ...customExercises];
}

function findExercise(id) {
  return exerciseById(id, allExercises());
}

/* ------------------------------------------------------------- tab views */

const tabs = document.querySelectorAll('.tab');
tabs.forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => {
    v.hidden = v.id !== `view-${name}`;
  });
  tabs.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.view === name)));
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------ toast, fmt */

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
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

function fmtDateLong(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
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
  const pace = numOrNull($(`${prefix}AvgPace`).value);
  if (duration != null && pace != null && pace > 0) {
    // Rounded to 1 decimal to match the field's step="0.1" (2dp would fail
    // the browser's native validation and silently block form submission).
    $(`${prefix}DistanceKm`).value = Math.round((duration / pace) * 10) / 10;
  }
}

/* --------------------------------------------------------------- LOG tab */

function sessionTypeOf(session) {
  return session.type ?? 'interval';
}

function resetLogForm() {
  $('logDate').value = todayIso();
  $('logType').value = 'interval';
  $('logDurationMin').value = '';
  $('logAvgPace').value = '';
  $('logDistanceKm').value = '';
  $('logRunAvgHR').value = '';
  $('logRunMaxHR').value = '';
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
    avgPace: numOrNull($(`${prefix}AvgPace`).value),
    distanceKm: numOrNull($(`${prefix}DistanceKm`).value),
    avgHR: numOrNull($(`${prefix}RunAvgHR`).value),
    maxHR: numOrNull($(`${prefix}RunMaxHR`).value),
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
  addSession(readSessionForm('log'));
  sessions = loadSessions();
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
      ${s.avgPace != null ? `<span class="mono">${s.avgPace}/km</span>` : ''}
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

  renderCalDayPanel(byDate);
}

function renderCalDayPanel(byDate) {
  const panel = $('calDayPanel');
  if (!calSelectedDate) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const day = byDate.get(calSelectedDate) || { sessions: [], workouts: [] };

  panel.hidden = false;
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
      if (s) openEditSheet(s);
    });
  });
  panel.querySelectorAll('.cal-day-item[data-workout-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = workouts.find((x) => x.id === btn.dataset.workoutId);
      if (w) openWorkoutEditSheet(w);
    });
  });
  $('calLogRunBtn').addEventListener('click', () => openLogSheet(calSelectedDate));
  $('calLogWorkoutBtn').addEventListener('click', () => openWorkoutSheet(calSelectedDate));
}

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
  const metaHTML = `<span class="mono">${exCount} exercise${exCount === 1 ? '' : 's'} · ${workoutVolume(w)}kg</span>`;
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
  const iso = cell.dataset.date;
  calSelectedDate = calSelectedDate === iso ? null : iso;
  renderCalendar();
});

/* ----------------------------------------------------------- DASHBOARD */

function renderDashboard() {
  const daysSinceRun = daysSinceLastSession(sessions);
  const daysSinceWorkout = daysSinceLastWorkout(workouts);
  const weekBuckets = mileageBuckets(sessions, 'week');
  const mileageThisWeek = weekBuckets.length ? weekBuckets[weekBuckets.length - 1].km : 0;

  $('dashStatGrid').innerHTML = [
    [String(sessions.length), 'Runs logged'],
    [String(workouts.length), 'Workouts logged'],
    [`${mileageThisWeek}km`, 'Mileage this week'],
    [`${volumeSince(workouts, 7)}kg`, 'Volume this week'],
    [daysSinceRun != null ? String(daysSinceRun) : '—', 'Days since last run'],
    [daysSinceWorkout != null ? String(daysSinceWorkout) : '—', 'Days since last workout'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  renderRecentActivity();
}

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
  $('editAvgPace').value = session.avgPace ?? '';
  $('editDistanceKm').value = session.distanceKm ?? '';
  $('editRunAvgHR').value = session.avgHR ?? '';
  $('editRunMaxHR').value = session.maxHR ?? '';
  $('editRPE').value = session.rpe;
  $('editRPEOut').textContent = String(session.rpe);
  $('editVO2max').value = session.vo2max ?? '';
  $('editNotes').value = session.notes ?? '';
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
  updateSession(editingId, readSessionForm('edit'));
  sessions = loadSessions();
  closeEditSheet();
  renderAll();
  toast('Session updated');
});

$('editDelete').addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('Delete this session? This cannot be undone.')) return;
  deleteSession(editingId);
  sessions = loadSessions();
  closeEditSheet();
  renderAll();
  toast('Session deleted');
});

/* ------------------------------------------------------------------ RUN */

function renderRunTab() {
  const avgHR = averageSessionHR(sessions);
  const daysSince = daysSinceLastSession(sessions);

  $('statGrid').innerHTML = [
    [String(sessions.length), 'Sessions logged'],
    [avgHR != null ? `${avgHR}` : '—', 'Avg session HR'],
    [daysSince != null ? String(daysSince) : '—', 'Days since last session'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
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

function setRowHTML(index, set = {}) {
  return `
    <div class="wo-set-row">
      <span class="wo-set-index">${index + 1}</span>
      <input type="number" class="wo-set-weight" step="0.5" min="0" inputmode="decimal" placeholder="kg" value="${set.weight ?? ''}">
      <input type="number" class="wo-set-reps" min="0" inputmode="numeric" placeholder="reps" value="${set.reps ?? ''}">
      <button type="button" class="wo-set-remove" aria-label="Remove set">✕</button>
    </div>
  `;
}

function exerciseBlockHTML(exerciseId, sets) {
  const ex = findExercise(exerciseId);
  if (!ex) return '';
  const last = lastPerformance(workouts, exerciseId);
  const lastText = last
    ? `Last (${fmtDateShort(last.date)}): ${last.sets.map((s) => `${s.weight}kg×${s.reps}`).join(', ') || '—'}`
    : 'No previous data for this exercise';
  return `
    <div class="wo-exercise-block" data-exercise-id="${exerciseId}">
      <div class="wo-exercise-header">
        <div>
          <div class="wo-exercise-name">${escapeHTML(ex.name)}</div>
          <div class="wo-exercise-meta">${escapeHTML(exerciseMetaText(ex))}</div>
        </div>
        <button type="button" class="wo-exercise-remove" aria-label="Remove exercise">✕</button>
      </div>
      ${muscleDiagramHTML(ex.muscles)}
      <p class="wo-last-performance">${lastText}</p>
      <div class="wo-set-row-heading"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
      <div class="wo-set-rows">${sets.map((s, i) => setRowHTML(i, s)).join('')}</div>
      <button type="button" class="wo-add-set ghost-btn">+ Add set</button>
    </div>
  `;
}

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

$('woAddExercise').addEventListener('click', () => {
  const opening = $('woPicker').hidden;
  $('woPicker').hidden = !opening;
  if (opening) {
    $('woPickerSearch').value = '';
    renderWoPickerChips();
    renderWoPickerResults();
    closeNewExerciseForm();
    $('woPickerSearch').focus();
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
  $('woPicker').hidden = true;
});

$('woExerciseList').addEventListener('click', (e) => {
  const removeExBtn = e.target.closest('.wo-exercise-remove');
  if (removeExBtn) {
    removeExBtn.closest('.wo-exercise-block').remove();
    return;
  }
  const addSetBtn = e.target.closest('.wo-add-set');
  if (addSetBtn) {
    const rows = addSetBtn.closest('.wo-exercise-block').querySelector('.wo-set-rows');
    rows.insertAdjacentHTML('beforeend', setRowHTML(rows.children.length));
    return;
  }
  const removeSetBtn = e.target.closest('.wo-set-remove');
  if (removeSetBtn) {
    const block = removeSetBtn.closest('.wo-exercise-block');
    const rows = block.querySelector('.wo-set-rows');
    if (rows.children.length > 1) {
      removeSetBtn.closest('.wo-set-row').remove();
      renumberSets(block);
    }
  }
});

function readWorkoutForm() {
  const exercises = [...$('woExerciseList').querySelectorAll('.wo-exercise-block')].map((block) => ({
    exerciseId: block.dataset.exerciseId,
    sets: [...block.querySelectorAll('.wo-set-row')]
      .map((row) => ({
        weight: numOrNull(row.querySelector('.wo-set-weight').value),
        reps: numOrNull(row.querySelector('.wo-set-reps').value),
      }))
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
  workoutEditingId = null;
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
  workoutEditingId = workout.id;
  $('woDate').value = workout.date;
  $('woName').value = workout.name || '';
  $('woNotes').value = workout.notes || '';
  $('woExerciseList').innerHTML = (workout.exercises || [])
    .map((ex) => exerciseBlockHTML(ex.exerciseId, ex.sets && ex.sets.length ? ex.sets : [{}]))
    .join('');
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
}

$('startWorkoutBtn').addEventListener('click', () => openWorkoutSheet(todayIso()));
$('woCancel').addEventListener('click', closeWorkoutSheet);

$('workoutForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = readWorkoutForm();
  if (data.exercises.length === 0) {
    toast('Add at least one exercise');
    return;
  }
  if (workoutEditingId) {
    updateWorkout(workoutEditingId, data);
    toast('Workout updated');
  } else {
    addWorkout(data);
    toast('Workout saved');
  }
  workouts = loadWorkouts();
  closeWorkoutSheet();
  renderAll();
});

$('woDelete').addEventListener('click', () => {
  if (!workoutEditingId) return;
  if (!confirm('Delete this workout? This cannot be undone.')) return;
  deleteWorkout(workoutEditingId);
  workouts = loadWorkouts();
  closeWorkoutSheet();
  renderAll();
  toast('Workout deleted');
});

function openExerciseSheet(exerciseId) {
  const ex = findExercise(exerciseId);
  if (!ex) return;
  exerciseSheetId = exerciseId;
  // Not in the built-in static library (checked with no custom exercises
  // mixed in) means the user created it themselves, and can delete it.
  $('exDetailDeleteCustom').hidden = Boolean(exerciseById(exerciseId));
  const pr = personalRecords(workouts, exerciseId);
  $('exDetailName').textContent = ex.name;
  $('exDetailMeta').textContent = exerciseMetaText(ex);
  $('exDetailDiagram').innerHTML = muscleDiagramHTML(ex.muscles);
  $('exDetailStatGrid').innerHTML = [
    [pr ? `${pr.maxWeight}kg` : '—', 'Best weight'],
    [pr ? `${pr.best1RM}kg` : '—', 'Est. 1RM'],
    [pr ? String(pr.timesLogged) : '0', 'Times logged'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');
  $('exDetailChart').innerHTML = exerciseProgressSVG(exerciseProgress(workouts, exerciseId));
  $('scrim').hidden = false;
  $('exerciseSheet').hidden = false;
  $('exerciseSheet').scrollTop = 0;
}

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

function renderExerciseSummaries() {
  const ids = loggedExerciseIds(workouts);
  $('exerciseSummaryEmpty').hidden = ids.length > 0;
  $('exerciseSummaryList').innerHTML = ids.map((id) => {
    const ex = findExercise(id);
    if (!ex) return '';
    const pr = personalRecords(workouts, id);
    return `
      <button type="button" class="exercise-summary-card" data-id="${id}">
        ${muscleDiagramHTML(ex.muscles)}
        <div class="exercise-summary-info">
          <div class="exercise-summary-name">${escapeHTML(ex.name)}</div>
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
            <span class="mono">${workoutVolume(w)}kg volume</span>
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
    [`${volumeSince(workouts, 7)}kg`, 'Volume this week'],
    [daysSince != null ? String(daysSince) : '—', 'Days since last workout'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  renderMuscleRadar();
  renderExerciseSummaries();
  renderWorkoutHistory();
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

  const p = settings.protocol;
  $('protocolCard').innerHTML = `
    <div><span class="k">Structure</span><span class="v">${p.reps} × ${p.workMin}min</span></div>
    <div><span class="k">Recovery between</span><span class="v">${p.restMin}min</span></div>
    <div><span class="k">Warm-up</span><span class="v">${p.warmupMin}min</span></div>
    <div><span class="k">Cool-down</span><span class="v">${p.cooldownMin}min</span></div>
    <div><span class="k">Frequency</span><span class="v">${p.freqPerWeek}×/week</span></div>
  `;
}

function renderHeaderZone() {
  const z = targetZone(settings);
  const modelLabel = settings.primaryZoneModel === 'rhr' ? 'RHR' : 'LTHR';
  $('headerZone').textContent = `${modelLabel} target ${z.bpmLow}–${z.bpmHigh}`;
}

/* ------------------------------------------------------------- SETTINGS */

function renderSettingsForm() {
  $('sBaselineVO2max').value = settings.baselineVO2max;
  $('sBaselineDate').value = settings.baselineDate;
  $('sDevice').value = settings.device;
  $('sRestingHR').value = settings.restingHR;
  $('sMaxHR').value = settings.maxHR;
  $('sLTHR').value = settings.lthr;
  $('sPrimaryModel').value = settings.primaryZoneModel;
  $('sReps').value = settings.protocol.reps;
  $('sWorkMin').value = settings.protocol.workMin;
  $('sRestMin').value = settings.protocol.restMin;
  $('sWarmupMin').value = settings.protocol.warmupMin;
  $('sCooldownMin').value = settings.protocol.cooldownMin;
  $('sFreq').value = settings.protocol.freqPerWeek;
}

$('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  settings = {
    baselineVO2max: Number($('sBaselineVO2max').value),
    baselineDate: $('sBaselineDate').value,
    device: $('sDevice').value.trim(),
    restingHR: Number($('sRestingHR').value),
    maxHR: Number($('sMaxHR').value),
    lthr: Number($('sLTHR').value),
    primaryZoneModel: $('sPrimaryModel').value,
    protocol: {
      reps: Number($('sReps').value),
      workMin: Number($('sWorkMin').value),
      restMin: Number($('sRestMin').value),
      warmupMin: Number($('sWarmupMin').value),
      cooldownMin: Number($('sCooldownMin').value),
      freqPerWeek: Number($('sFreq').value),
    },
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
  renderAll();
  clearSaved($('settingsSaveBtn'));
  toast('Settings reset');
});

/* ------------------------------------------------------------------ boot */

function renderAll() {
  renderHeaderZone();
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
