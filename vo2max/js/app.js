import {
  loadSettings, saveSettings, resetSettings,
  loadSessions, addSession, updateSession, deleteSession,
  exportAll, importAll,
} from './store.js';
import { lthrZoneTable, rhrZoneTable, targetZone } from './zones.js';
import {
  todayIso,
  daysSinceLastSession, averageIntervalHR, vo2maxSeries,
  mileageBuckets, totalMileage,
} from './block.js';
import { vo2maxTrendSVG, mileageBarChartSVG } from './chart.js';
import { sessionToICS } from './ics.js';

let settings = loadSettings();
let sessions = loadSessions();
let editingId = null;
let mileageScope = 'week';

const $ = (id) => document.getElementById(id);

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

/* --------------------------------------------------------- interval rows */

function buildIntervalRows(container, count, existing = []) {
  const prevAvg = [...container.querySelectorAll('.iv-avg')].map((i) => i.value);
  const prevPeak = [...container.querySelectorAll('.iv-peak')].map((i) => i.value);
  const prevDuration = [...container.querySelectorAll('.iv-duration')].map((i) => i.value);
  const defaultDuration = settings.protocol.workMin;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'interval-row';
    const avgVal = existing[i]?.avgHR ?? prevAvg[i] ?? '';
    const peakVal = existing[i]?.peakHR ?? prevPeak[i] ?? '';
    const durationVal = existing[i]?.durationMin ?? prevDuration[i] ?? defaultDuration;
    row.innerHTML = `
      <span class="iv-label">S${i + 1}</span>
      <input class="iv-avg" type="number" inputmode="numeric" min="60" max="230" placeholder="avg" value="${avgVal}">
      <input class="iv-peak" type="number" inputmode="numeric" min="60" max="230" placeholder="peak" value="${peakVal}">
      <input class="iv-duration" type="number" inputmode="decimal" step="0.1" min="0" max="60" placeholder="min" value="${durationVal}">
    `;
    container.appendChild(row);
  }
}

function readIntervalRows(container) {
  return [...container.querySelectorAll('.interval-row')].map((row) => ({
    avgHR: numOrNull(row.querySelector('.iv-avg').value),
    peakHR: numOrNull(row.querySelector('.iv-peak').value),
    durationMin: numOrNull(row.querySelector('.iv-duration').value),
  }));
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Live "Average HR" readout under the interval rows, from whatever avg values are filled in so far. */
function updateComputedAvgHR(prefix) {
  const el = $(`${prefix}AvgHR`);
  if (!el) return;
  const vals = [...$(`${prefix}IntervalRows`).querySelectorAll('.iv-avg')]
    .map((i) => numOrNull(i.value))
    .filter((v) => v != null);
  el.innerHTML = vals.length
    ? `Session avg HR: <span class="mono">${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}</span> bpm`
    : '';
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

function toggleTypeFields(prefix, type) {
  $(`${prefix}IntervalFields`).hidden = type !== 'interval';
  $(`${prefix}RunFields`).hidden = type === 'interval';
}

function sessionTypeOf(session) {
  return session.type ?? 'interval';
}

function resetLogForm() {
  $('logDate').value = todayIso();
  $('logType').value = 'interval';
  toggleTypeFields('log', 'interval');
  $('logIntervals').value = settings.protocol.reps;
  buildIntervalRows($('logIntervalRows'), settings.protocol.reps);
  updateComputedAvgHR('log');
  $('logRecovery').value = 'moderate';
  $('logDurationMin').value = '';
  $('logAvgPace').value = '';
  $('logDistanceKm').value = '';
  $('logRunAvgHR').value = '';
  $('logRunMaxHR').value = '';
  $('logRPE').value = 6;
  $('logRPEOut').textContent = '6';
  $('logNotes').value = '';
}

$('logType').addEventListener('change', () => toggleTypeFields('log', $('logType').value));

$('logIntervals').addEventListener('input', () => {
  const n = Math.max(0, Math.min(20, Number($('logIntervals').value) || 0));
  buildIntervalRows($('logIntervalRows'), n);
  updateComputedAvgHR('log');
});

$('logIntervalRows').addEventListener('input', (e) => {
  if (e.target.classList.contains('iv-avg')) updateComputedAvgHR('log');
});

$('logDurationMin').addEventListener('input', () => updateComputedDistance('log'));
$('logAvgPace').addEventListener('input', () => updateComputedDistance('log'));

$('logRPE').addEventListener('input', () => { $('logRPEOut').textContent = $('logRPE').value; });

function readSessionForm(prefix) {
  const type = $(`${prefix}Type`).value;
  // The Log form has no VO2max field (only Edit does, for filling one in after the fact).
  const vo2maxEl = $(`${prefix}VO2max`);
  const base = {
    type,
    date: $(`${prefix}Date`).value,
    rpe: Number($(`${prefix}RPE`).value),
    vo2max: vo2maxEl ? numOrNull(vo2maxEl.value) : null,
    notes: $(`${prefix}Notes`).value.trim(),
    intervalsCompleted: 0,
    intervals: [],
    recovery: null,
    durationMin: null,
    avgPace: null,
    distanceKm: null,
    avgHR: null,
    maxHR: null,
  };
  if (type === 'interval') {
    base.intervalsCompleted = Number($(`${prefix}Intervals`).value) || 0;
    base.intervals = readIntervalRows($(`${prefix}IntervalRows`));
    base.recovery = $(`${prefix}Recovery`).value;
  } else {
    base.durationMin = numOrNull($(`${prefix}DurationMin`).value);
    base.avgPace = numOrNull($(`${prefix}AvgPace`).value);
    base.distanceKm = numOrNull($(`${prefix}DistanceKm`).value);
    base.avgHR = numOrNull($(`${prefix}RunAvgHR`).value);
    base.maxHR = numOrNull($(`${prefix}RunMaxHR`).value);
  }
  return base;
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

function renderHistory() {
  const list = $('historyList');
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = '';
  $('historyEmpty').hidden = sorted.length > 0;

  for (const s of sorted) {
    const type = sessionTypeOf(s);
    const isInterval = type === 'interval';
    let metaHTML;
    let badgeHTML;

    if (isInterval) {
      const avgs = (s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
      const peaks = (s.intervals || []).map((iv) => iv.peakHR).filter((v) => v != null);
      const avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
      const peakHR = peaks.length ? Math.max(...peaks) : null;
      badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
      metaHTML = `
        <span>${s.intervalsCompleted} interval${s.intervalsCompleted === 1 ? '' : 's'}</span>
        ${avgHR != null ? `<span class="mono">avg ${avgHR}</span>` : ''}
        ${peakHR != null ? `<span class="mono">peak ${peakHR}</span>` : ''}
        ${s.recovery ? `<span>${recoverySymbol[s.recovery] ?? ''} ${recoveryLabel[s.recovery] ?? s.recovery}</span>` : ''}
        <span class="mono">RPE ${s.rpe}</span>
        ${s.vo2max != null ? `<span class="mono">VO2 ${s.vo2max}</span>` : ''}
      `;
    } else {
      badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
      metaHTML = `
        ${s.durationMin != null ? `<span class="mono">${s.durationMin}min</span>` : ''}
        ${s.distanceKm != null ? `<span class="mono">${s.distanceKm}km</span>` : ''}
        ${s.avgPace != null ? `<span class="mono">${s.avgPace}/km</span>` : ''}
        ${s.avgHR != null ? `<span class="mono">avg ${s.avgHR}</span>` : ''}
        ${s.maxHR != null ? `<span class="mono">max ${s.maxHR}</span>` : ''}
        <span class="mono">RPE ${s.rpe}</span>
        ${s.vo2max != null ? `<span class="mono">VO2 ${s.vo2max}</span>` : ''}
      `;
    }

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

function sessionsByDate() {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  return map;
}

function renderCalendar() {
  const byDate = sessionsByDate();

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
    const has = byDate.has(iso);
    const classes = ['cal-cell'];
    if (has) classes.push('has-session');
    if (iso === todayIsoStr) classes.push('today');
    if (iso === calSelectedDate) classes.push('selected');
    html += `<button type="button" class="${classes.join(' ')}" data-date="${iso}">
      <span>${d}</span>
      ${has ? '<span class="cal-dot"></span>' : ''}
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
  const daySessions = byDate.get(calSelectedDate) || [];
  panel.hidden = false;
  panel.innerHTML = `
    <div class="cal-day-panel-date mono">${fmtDateLong(calSelectedDate)}</div>
    ${daySessions.map((s) => calDaySummaryHTML(s)).join('')}
    <button type="button" id="calLogBtn" class="ghost-btn block">+ Log session on this day</button>
  `;
  panel.querySelectorAll('.cal-day-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = sessions.find((x) => x.id === btn.dataset.id);
      if (s) openEditSheet(s);
    });
  });
  $('calLogBtn').addEventListener('click', () => openLogSheet(calSelectedDate));
}

/** A simplified, at-a-glance summary of one session for the calendar day panel. */
function calDaySummaryHTML(s) {
  const type = sessionTypeOf(s);
  const isInterval = type === 'interval';
  let badgeHTML;
  let metaHTML;
  if (isInterval) {
    const avgs = (s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
    const avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
    badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
    metaHTML = `<span class="mono">${s.intervalsCompleted} interval${s.intervalsCompleted === 1 ? '' : 's'}${avgHR != null ? ` · avg ${avgHR}` : ''}</span>`;
  } else {
    badgeHTML = `<span class="pill pill-type">${typeLabel[type] ?? type}</span>`;
    metaHTML = `<span class="mono">${[
      s.distanceKm != null ? `${s.distanceKm}km` : null,
      s.durationMin != null ? `${s.durationMin}min` : null,
    ].filter(Boolean).join(' · ')}</span>`;
  }
  return `
    <button type="button" class="cal-day-item" data-id="${s.id}">
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
  // An empty day has nothing to show, so go straight to logging one; a day
  // that already has a session opens the day panel to view/edit it (which
  // also offers "+ Log session" for a second entry the same day).
  if (!cell.classList.contains('has-session')) {
    calSelectedDate = iso;
    renderCalendar();
    openLogSheet(iso);
    return;
  }
  calSelectedDate = calSelectedDate === iso ? null : iso;
  renderCalendar();
});

/* --------------------------------------------------------- edit sheet */

function openEditSheet(session) {
  editingId = session.id;
  const type = sessionTypeOf(session);
  $('editDate').value = session.date;
  $('editType').value = type;
  toggleTypeFields('edit', type);
  $('editIntervals').value = session.intervalsCompleted || 0;
  buildIntervalRows($('editIntervalRows'), session.intervalsCompleted || 0, session.intervals || []);
  updateComputedAvgHR('edit');
  $('editRecovery').value = session.recovery ?? 'moderate';
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
});
$('editCancel').addEventListener('click', closeEditSheet);

$('editType').addEventListener('change', () => toggleTypeFields('edit', $('editType').value));

$('editIntervals').addEventListener('input', () => {
  const n = Math.max(0, Math.min(20, Number($('editIntervals').value) || 0));
  buildIntervalRows($('editIntervalRows'), n);
  updateComputedAvgHR('edit');
});

$('editIntervalRows').addEventListener('input', (e) => {
  if (e.target.classList.contains('iv-avg')) updateComputedAvgHR('edit');
});

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

/* ------------------------------------------------------------- PROGRESS */

function renderProgress() {
  const avgHR = averageIntervalHR(sessions);
  const daysSince = daysSinceLastSession(sessions);

  $('statGrid').innerHTML = [
    [String(sessions.length), 'Sessions logged'],
    [avgHR != null ? `${avgHR}` : '—', 'Avg interval HR'],
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

$('mileageScope').addEventListener('click', (e) => {
  const btn = e.target.closest('.scope');
  if (!btn) return;
  mileageScope = btn.dataset.scope;
  $('mileageScope').querySelectorAll('.scope').forEach((b) => {
    b.setAttribute('aria-selected', String(b === btn));
  });
  $('mileageChartWrap').innerHTML = mileageBarChartSVG(mileageBuckets(sessions, mileageScope));
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
  renderHistory();
  renderCalendar();
  renderProgress();
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
