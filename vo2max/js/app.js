import {
  loadSettings, saveSettings, resetSettings,
  loadSessions, addSession, updateSession, deleteSession,
  exportAll, importAll,
} from './store.js';
import { lthrZoneTable, rhrZoneTable, targetZone } from './zones.js';
import {
  todayIso, currentWeek, retestWeeks, sessionChecklist,
  daysSinceLastSession, averageIntervalHR, vo2maxSeries,
} from './block.js';
import { vo2maxTrendSVG } from './chart.js';

let settings = loadSettings();
let sessions = loadSessions();
let editingId = null;

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

function fmtDateLong(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/* --------------------------------------------------------- interval rows */

function buildIntervalRows(container, count, existing = []) {
  const prevAvg = [...container.querySelectorAll('.iv-avg')].map((i) => i.value);
  const prevPeak = [...container.querySelectorAll('.iv-peak')].map((i) => i.value);
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'interval-row';
    const avgVal = existing[i]?.avgHR ?? prevAvg[i] ?? '';
    const peakVal = existing[i]?.peakHR ?? prevPeak[i] ?? '';
    row.innerHTML = `
      <span class="iv-label">R${i + 1}</span>
      <input class="iv-avg" type="number" inputmode="numeric" min="60" max="230" placeholder="avg bpm" value="${avgVal}">
      <input class="iv-peak" type="number" inputmode="numeric" min="60" max="230" placeholder="peak bpm" value="${peakVal}">
    `;
    container.appendChild(row);
  }
}

function readIntervalRows(container) {
  return [...container.querySelectorAll('.interval-row')].map((row) => ({
    avgHR: numOrNull(row.querySelector('.iv-avg').value),
    peakHR: numOrNull(row.querySelector('.iv-peak').value),
  }));
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/* --------------------------------------------------------------- LOG tab */

function resetLogForm() {
  $('logDate').value = todayIso();
  $('logIntervals').value = settings.protocol.reps;
  buildIntervalRows($('logIntervalRows'), settings.protocol.reps);
  $('logRecovery').value = 'moderate';
  $('logRPE').value = 6;
  $('logRPEOut').textContent = '6';
  $('logVO2max').value = '';
  $('logNotes').value = '';
}

$('logIntervals').addEventListener('input', () => {
  const n = Math.max(0, Math.min(20, Number($('logIntervals').value) || 0));
  buildIntervalRows($('logIntervalRows'), n);
});

$('logRPE').addEventListener('input', () => { $('logRPEOut').textContent = $('logRPE').value; });

$('logForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const n = Number($('logIntervals').value) || 0;
  addSession({
    date: $('logDate').value,
    intervalsCompleted: n,
    intervals: readIntervalRows($('logIntervalRows')),
    recovery: $('logRecovery').value,
    rpe: Number($('logRPE').value),
    vo2max: numOrNull($('logVO2max').value),
    notes: $('logNotes').value.trim(),
  });
  sessions = loadSessions();
  resetLogForm();
  renderAll();
  toast('Session saved');
});

/* ------------------------------------------------------------- HISTORY */

const recoveryLabel = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

function renderHistory() {
  const list = $('historyList');
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = '';
  $('historyEmpty').hidden = sorted.length > 0;

  for (const s of sorted) {
    const avgs = (s.intervals || []).map((iv) => iv.avgHR).filter((v) => v != null);
    const peaks = (s.intervals || []).map((iv) => iv.peakHR).filter((v) => v != null);
    const avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
    const peakHR = peaks.length ? Math.max(...peaks) : null;

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-item';
    btn.innerHTML = `
      <div class="history-top">
        <span class="history-date">${fmtDateLong(s.date)}</span>
        <span class="pill pill-${s.recovery}">${recoveryLabel[s.recovery] ?? s.recovery}</span>
      </div>
      <div class="history-meta">
        <span>${s.intervalsCompleted} interval${s.intervalsCompleted === 1 ? '' : 's'}</span>
        ${avgHR != null ? `<span class="mono">avg ${avgHR}</span>` : ''}
        ${peakHR != null ? `<span class="mono">peak ${peakHR}</span>` : ''}
        <span class="mono">RPE ${s.rpe}</span>
        ${s.vo2max != null ? `<span class="mono">VO2 ${s.vo2max}</span>` : ''}
      </div>
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

/* --------------------------------------------------------- edit sheet */

function openEditSheet(session) {
  editingId = session.id;
  $('editDate').value = session.date;
  $('editIntervals').value = session.intervalsCompleted;
  buildIntervalRows($('editIntervalRows'), session.intervalsCompleted, session.intervals || []);
  $('editRecovery').value = session.recovery;
  $('editRPE').value = session.rpe;
  $('editRPEOut').textContent = String(session.rpe);
  $('editVO2max').value = session.vo2max ?? '';
  $('editNotes').value = session.notes ?? '';
  $('scrim').hidden = false;
  $('editSheet').hidden = false;
}

function closeEditSheet() {
  editingId = null;
  $('scrim').hidden = true;
  $('editSheet').hidden = true;
}

$('scrim').addEventListener('click', closeEditSheet);
$('editCancel').addEventListener('click', closeEditSheet);

$('editIntervals').addEventListener('input', () => {
  const n = Math.max(0, Math.min(20, Number($('editIntervals').value) || 0));
  buildIntervalRows($('editIntervalRows'), n);
});

$('editRPE').addEventListener('input', () => { $('editRPEOut').textContent = $('editRPE').value; });

$('editForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!editingId) return;
  const n = Number($('editIntervals').value) || 0;
  updateSession(editingId, {
    date: $('editDate').value,
    intervalsCompleted: n,
    intervals: readIntervalRows($('editIntervalRows')),
    recovery: $('editRecovery').value,
    rpe: Number($('editRPE').value),
    vo2max: numOrNull($('editVO2max').value),
    notes: $('editNotes').value.trim(),
  });
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
  const week = currentWeek(settings);
  const total = settings.protocol.blockWeeks;
  const avgHR = averageIntervalHR(sessions);
  const daysSince = daysSinceLastSession(sessions);

  $('statGrid').innerHTML = [
    [String(sessions.length), 'Sessions logged'],
    [`Week ${week} of ${total}`, 'Block progress'],
    [avgHR != null ? `${avgHR}` : '—', 'Avg interval HR'],
    [daysSince != null ? String(daysSince) : '—', 'Days since last session'],
  ].map(([value, label]) => `
    <div class="stat-tile">
      <div class="stat-value mono">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  $('chartWrap').innerHTML = vo2maxTrendSVG(vo2maxSeries(settings, sessions));

  const checklist = sessionChecklist(settings, sessions);
  $('checklist').innerHTML = checklist.map((c) => `
    <div class="checklist-cell ${c.done ? 'done' : ''}" title="Week ${c.week}${c.date ? ` · ${c.date}` : ''}">
      ${c.index}
    </div>
  `).join('');
}

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
  const [midWeek, endWeek] = retestWeeks(settings);
  $('protocolCard').innerHTML = `
    <div><span class="k">Structure</span><span class="v">${p.reps} × ${p.workMin}min</span></div>
    <div><span class="k">Recovery between</span><span class="v">${p.restMin}min</span></div>
    <div><span class="k">Warm-up</span><span class="v">${p.warmupMin}min</span></div>
    <div><span class="k">Cool-down</span><span class="v">${p.cooldownMin}min</span></div>
    <div><span class="k">Frequency</span><span class="v">${p.freqPerWeek}×/week</span></div>
    <div><span class="k">Block length</span><span class="v">${p.blockWeeks} weeks</span></div>
    <div class="full"><span class="k">Retest VO2max</span><span class="v">Week ${midWeek} &amp; Week ${endWeek}</span></div>
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
  $('sStartDate').value = settings.protocolStartDate;
  $('sReps').value = settings.protocol.reps;
  $('sWorkMin').value = settings.protocol.workMin;
  $('sRestMin').value = settings.protocol.restMin;
  $('sWarmupMin').value = settings.protocol.warmupMin;
  $('sCooldownMin').value = settings.protocol.cooldownMin;
  $('sFreq').value = settings.protocol.freqPerWeek;
  $('sBlockWeeks').value = settings.protocol.blockWeeks;
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
    protocolStartDate: $('sStartDate').value,
    protocol: {
      reps: Number($('sReps').value),
      workMin: Number($('sWorkMin').value),
      restMin: Number($('sRestMin').value),
      warmupMin: Number($('sWarmupMin').value),
      cooldownMin: Number($('sCooldownMin').value),
      freqPerWeek: Number($('sFreq').value),
      blockWeeks: Number($('sBlockWeeks').value),
    },
  };
  saveSettings(settings);
  renderAll();
  toast('Settings saved');
});

$('sExport').addEventListener('click', () => {
  const blob = new Blob([exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vo2max-export-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  toast('Settings reset');
});

/* ------------------------------------------------------------------ boot */

function renderAll() {
  renderHeaderZone();
  renderHistory();
  renderProgress();
  renderZones();
  renderSettingsForm();
}

resetLogForm();
renderAll();
switchView('log');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
