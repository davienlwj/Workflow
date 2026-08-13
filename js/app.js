/* Workflow - UI wiring. */

import { parseTask, formatTime, formatDate, toISODate, fromISODate } from './parser.js';
import { SCOPES, rangeFor, groupByDate, summaryText, emptyText } from './ranges.js';
import { holidaysBetween, tonesByDate, toneOf, observedLabel } from './holidays.js';
import * as store from './store.js';

const $ = (id) => document.getElementById(id);

const el = {
  prev: $('prev'), next: $('next'), title: $('title'), settingsBtn: $('settingsBtn'),
  weekdays: $('weekdays'), grid: $('grid'), scopes: $('scopes'), dayTitle: $('dayTitle'),
  counts: $('counts'), list: $('list'), empty: $('empty'),
  composer: $('composer'), input: $('input'), mic: $('mic'), send: $('send'),
  scrim: $('scrim'), sheet: $('sheet'), sheetForm: $('sheetForm'),
  fTitle: $('fTitle'), fDate: $('fDate'), fTime: $('fTime'), fLocation: $('fLocation'),
  fRaw: $('fRaw'), fDelete: $('fDelete'), fCancel: $('fCancel'), fSave: $('fSave'),
  settingsSheet: $('settingsSheet'), sDayFirst: $('sDayFirst'), sUse24: $('sUse24'),
  sWeekStart: $('sWeekStart'), sExport: $('sExport'), sImport: $('sImport'),
  sClose: $('sClose'), sFile: $('sFile'), toast: $('toast'),
};

const today = () => new Date();
let view = new Date(today().getFullYear(), today().getMonth(), 1);
let selected = toISODate(today());
let scope = SCOPES.includes(store.settings.scope) ? store.settings.scope : 'day';
let editingId = null;

// Fields the sheet does not expose, carried from the parse to the save.
let pendingEndTime = null;
let pendingPeople = [];
let pendingRaw = '';

/* ---------------------------------------------------------------- render */

function renderWeekdays() {
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const start = store.settings.weekStart;
  el.weekdays.replaceChildren(
    ...Array.from({ length: 7 }, (_, i) => {
      const d = document.createElement('div');
      d.textContent = names[(start + i) % 7];
      return d;
    }),
  );
}

function renderGrid() {
  el.title.textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() - store.settings.weekStart + 7) % 7;
  const counts = store.countsByDate();
  const tones = tonesByDate();
  const todayISO = toISODate(today());
  // Showing a week? Mark it on the grid so the summary's span is obvious.
  const week = scope === 'week' ? currentRange() : null;
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(1 - offset + i);
    const iso = toISODate(d);
    const count = counts.get(iso) || 0;
    const dayTones = tones.get(iso) || [];

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.date = iso;
    if (d.getMonth() !== view.getMonth()) cell.classList.add('outside');
    if (iso === todayISO) cell.classList.add('today');
    if (week && iso >= week.start && iso <= week.end) cell.classList.add('in-range');
    if (iso === selected) cell.classList.add('selected');
    const spoken = [d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })];
    if (count) spoken.push(`${count} task${count > 1 ? 's' : ''}`);
    if (dayTones.includes('local')) spoken.push('public holiday');
    else if (dayTones.length) spoken.push('holiday in another state');
    cell.setAttribute('aria-label', spoken.join(', '));

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(d.getDate());
    cell.append(num);

    const dots = document.createElement('span');
    dots.className = 'dots-row';
    // Holidays lead, so their colour is what catches the eye on a busy day.
    for (const tone of dayTones) {
      const dot = document.createElement('i');
      dot.className = `dot dot-${tone}`;
      dots.append(dot);
    }
    for (let k = 0; k < Math.min(count, 3 - dayTones.length); k++) {
      const dot = document.createElement('i');
      dot.className = 'dot';
      dots.append(dot);
    }
    cell.append(dots);
    cells.push(cell);
  }
  el.grid.replaceChildren(...cells);
}

/** The window the summary is showing: the selected day, or its week/month/year. */
function currentRange() {
  return rangeFor(scope, selected, store.settings.weekStart, today());
}

function renderScopes() {
  for (const button of el.scopes.querySelectorAll('.scope')) {
    button.setAttribute('aria-selected', String(button.dataset.scope === scope));
  }
}

function taskRow(t) {
  const li = document.createElement('li');
  li.className = `item${t.done ? ' done' : ''}`;

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.setAttribute('aria-label', t.done ? 'Mark as not done' : 'Mark as done');
  check.addEventListener('click', () => {
    store.toggleDone(t.id);
    renderList();
  });

  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'body';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = t.title;
  body.append(title);

  const bits = [];
  if (t.time) bits.push(formatTime(t.time, store.settings.use24)
    + (t.endTime ? `–${formatTime(t.endTime, store.settings.use24)}` : ''));
  if (t.location) bits.push(t.location);
  if (bits.length) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = bits.join('  ·  ');
    body.append(meta);
  }
  body.addEventListener('click', () => openSheet(t, t.id));

  li.append(check, body);
  return li;
}

function dayHeading(iso) {
  const li = document.createElement('li');
  li.className = 'group';
  const d = fromISODate(iso);
  const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  li.textContent = iso === toISODate(today()) ? `Today · ${label}` : label;
  return li;
}

/** A public holiday: no checkbox, just a coloured dot and who it applies to. */
function holidayRow(h) {
  const li = document.createElement('li');
  li.className = `item holiday ${toneOf(h) === 'local' ? 'holiday-local' : 'holiday-other'}`;

  const mark = document.createElement('span');
  mark.className = 'holiday-dot';
  mark.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'body';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = h.name;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = observedLabel(h);

  body.append(title, meta);
  li.append(mark, body);
  return li;
}

function renderList() {
  const { start, end, label } = currentRange();
  const tasks = store.tasksBetween(start, end);
  const holidays = holidaysBetween(start, end);

  el.dayTitle.textContent = label;
  el.counts.textContent = summaryText(tasks, holidays.length);
  el.empty.textContent = emptyText(scope);
  el.empty.hidden = tasks.length + holidays.length > 0;

  const rows = [];
  if (scope === 'day') {
    rows.push(...holidays.map(holidayRow), ...tasks.map(taskRow));
  } else {
    // Longer ranges get a heading per day, so a month reads as a list of days.
    const byDate = new Map();
    for (const [iso, ofDay] of groupByDate(holidays)) byDate.set(iso, { holidays: ofDay, tasks: [] });
    for (const [iso, ofDay] of groupByDate(tasks)) {
      const entry = byDate.get(iso) || { holidays: [], tasks: [] };
      entry.tasks = ofDay;
      byDate.set(iso, entry);
    }
    for (const iso of [...byDate.keys()].sort()) {
      const { holidays: hs, tasks: ts } = byDate.get(iso);
      rows.push(dayHeading(iso), ...hs.map(holidayRow), ...ts.map(taskRow));
    }
  }
  el.list.replaceChildren(...rows);
}

function render() {
  renderScopes();
  renderWeekdays();
  renderGrid();
  renderList();
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
}

/* ----------------------------------------------------------------- sheet */

function openSheet(fields, id = null) {
  editingId = id;
  el.fTitle.value = fields.title && fields.title !== 'Untitled' ? fields.title : '';
  el.fDate.value = fields.date || selected;
  el.fTime.value = fields.time || '';
  el.fLocation.value = fields.location || '';
  el.fRaw.textContent = !id && fields.raw ? `“${fields.raw}”` : '';
  el.fRaw.hidden = !el.fRaw.textContent;
  el.fDelete.hidden = !id;
  el.fSave.textContent = id ? 'Save' : 'Add';

  el.scrim.hidden = false;
  el.sheet.hidden = false;
  // Land on the field most likely to need a fix, without forcing the keyboard
  // open on mobile when everything already parsed cleanly.
  if (!el.fTitle.value) el.fTitle.focus();
}

function closeSheet() {
  el.sheet.hidden = true;
  el.settingsSheet.hidden = true;
  el.scrim.hidden = true;
  editingId = null;
}

el.sheetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const isEdit = Boolean(editingId);
  const fields = {
    title: el.fTitle.value.trim() || 'Untitled',
    date: el.fDate.value || selected,
    time: el.fTime.value || null,
    location: el.fLocation.value.trim() || null,
  };
  if (isEdit) {
    // A hand-edited start time invalidates the end time that came with it.
    const before = store.getTask(editingId);
    if (before && before.time !== fields.time) fields.endTime = null;
    store.updateTask(editingId, fields);
  } else {
    store.addTask({ ...fields, endTime: pendingEndTime, people: pendingPeople, raw: pendingRaw });
  }

  selected = fields.date;
  const d = fromISODate(selected);
  view = new Date(d.getFullYear(), d.getMonth(), 1);
  pendingEndTime = null;
  pendingPeople = [];
  pendingRaw = '';
  closeSheet();
  render();
  toast(isEdit ? 'Saved' : `Added · ${formatDate(fields.date, today())}`);
});

el.fDelete.addEventListener('click', () => {
  if (editingId) store.removeTask(editingId);
  closeSheet();
  render();
  toast('Deleted');
});

el.fCancel.addEventListener('click', closeSheet);
el.scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

/* -------------------------------------------------------------- composer */

function review(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const parsed = parseTask(trimmed, { dayFirst: store.settings.dayFirst });
  pendingEndTime = parsed.endTime;
  pendingPeople = parsed.people;
  pendingRaw = parsed.raw;
  el.input.value = '';
  el.input.blur();
  openSheet(parsed, null);
}

el.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  review(el.input.value);
});

/* ------------------------------------------------------------- dictation */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  let listening = false;
  let finalText = '';

  el.mic.hidden = false;

  el.mic.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    finalText = '';
    try {
      recognition.start();
    } catch {
      /* already starting */
    }
  });

  recognition.addEventListener('start', () => {
    listening = true;
    el.mic.classList.add('listening');
    el.input.placeholder = 'Listening…';
  });

  recognition.addEventListener('result', (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += chunk;
      else interim += chunk;
    }
    el.input.value = (finalText + interim).trim();
  });

  recognition.addEventListener('error', (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      toast('Microphone blocked. Use the mic on your keyboard instead.');
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      toast('Could not hear that.');
    }
  });

  recognition.addEventListener('end', () => {
    listening = false;
    el.mic.classList.remove('listening');
    el.input.placeholder = 'Meeting with Tom at KLCC at 3pm on 12/8';
    // Straight into review, so dictating a task is one tap and one sentence.
    if (el.input.value.trim()) review(el.input.value);
  });
}

/* ------------------------------------------------------------- navigation */

el.scopes.addEventListener('click', (e) => {
  const button = e.target.closest('.scope');
  if (!button || button.dataset.scope === scope) return;
  scope = button.dataset.scope;
  store.saveSettings({ scope });
  renderScopes();
  renderGrid();   // the week highlight follows the scope
  renderList();
});

function shiftMonth(delta) {
  view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
  renderGrid();
}

el.prev.addEventListener('click', () => shiftMonth(-1));
el.next.addEventListener('click', () => shiftMonth(1));

el.title.addEventListener('click', () => {
  const now = today();
  view = new Date(now.getFullYear(), now.getMonth(), 1);
  selected = toISODate(now);
  render();
});

el.grid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  selected = cell.dataset.date;
  const d = fromISODate(selected);
  if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
    view = new Date(d.getFullYear(), d.getMonth(), 1);
  }
  renderGrid();
  renderList();
});

// Swipe the grid sideways to change month.
let touchX = 0;
let touchY = 0;
el.grid.addEventListener('touchstart', (e) => {
  touchX = e.changedTouches[0].clientX;
  touchY = e.changedTouches[0].clientY;
}, { passive: true });

el.grid.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 60 && Math.abs(dy) < 40) shiftMonth(dx < 0 ? 1 : -1);
}, { passive: true });

/* --------------------------------------------------------------- settings */

el.settingsBtn.addEventListener('click', () => {
  el.sDayFirst.checked = store.settings.dayFirst;
  el.sUse24.checked = store.settings.use24;
  el.sWeekStart.checked = store.settings.weekStart === 1;
  el.scrim.hidden = false;
  el.settingsSheet.hidden = false;
});

el.sDayFirst.addEventListener('change', () => store.saveSettings({ dayFirst: el.sDayFirst.checked }));
el.sUse24.addEventListener('change', () => {
  store.saveSettings({ use24: el.sUse24.checked });
  renderList();
});
el.sWeekStart.addEventListener('change', () => {
  store.saveSettings({ weekStart: el.sWeekStart.checked ? 1 : 0 });
  renderWeekdays();
  renderGrid();
  renderList(); // a week summary now spans different days
});
el.sClose.addEventListener('click', closeSheet);

el.sExport.addEventListener('click', () => {
  const blob = new Blob([store.exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workflow-${toISODate(today())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

el.sImport.addEventListener('click', () => el.sFile.click());
el.sFile.addEventListener('change', async () => {
  const file = el.sFile.files[0];
  if (!file) return;
  try {
    const added = store.importAll(await file.text());
    render();
    toast(`Imported ${added} task${added === 1 ? '' : 's'}`);
  } catch {
    toast('That file could not be read.');
  }
  el.sFile.value = '';
});

/* ----------------------------------------------------------------- chrome */

// Keep the composer above the on-screen keyboard.
if (window.visualViewport) {
  const fit = () => { document.body.style.height = `${window.visualViewport.height}px`; };
  window.visualViewport.addEventListener('resize', fit);
  window.visualViewport.addEventListener('scroll', fit);
}

// Roll "Today" over at midnight without disturbing anything else.
let currentDay = toISODate(today());
setInterval(() => {
  const iso = toISODate(today());
  if (iso !== currentDay) {
    currentDay = iso;
    render();
  }
}, 60_000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  });
}

render();
