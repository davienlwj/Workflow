/* Workflow - local storage. Everything lives on the device, no accounts. */

const TASKS_KEY = 'workflow.tasks.v1';
const SETTINGS_KEY = 'workflow.settings.v1';

const DEFAULT_SETTINGS = {
  dayFirst: true,   // read "12/8" as 12 August
  use24: false,     // show 3pm rather than 15:00
  weekStart: 1,     // 0 = Sunday, 1 = Monday
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full disk - the session still works in memory */
  }
}

let tasks = read(TASKS_KEY, []).filter((t) => t && t.id);
export const settings = { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };

function persist() {
  write(TASKS_KEY, tasks);
}

export function saveSettings(patch) {
  Object.assign(settings, patch);
  write(SETTINGS_KEY, settings);
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function allTasks() {
  return tasks;
}

/** Tasks on one ISO day, earliest first, untimed ones last. */
export function tasksOn(iso) {
  return tasks
    .filter((t) => t.date === iso)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.createdAt - b.createdAt;
    });
}

/** ISO date -> number of tasks, for the calendar dots. */
export function countsByDate() {
  const map = new Map();
  for (const t of tasks) {
    if (!t.date) continue;
    map.set(t.date, (map.get(t.date) || 0) + 1);
  }
  return map;
}

export function getTask(id) {
  return tasks.find((t) => t.id === id) || null;
}

export function addTask(fields) {
  const task = {
    id: newId(),
    title: 'Untitled',
    date: null,
    time: null,
    endTime: null,
    location: null,
    people: [],
    raw: '',
    done: false,
    createdAt: Date.now(),
    ...fields,
  };
  tasks.push(task);
  persist();
  return task;
}

export function updateTask(id, patch) {
  const task = getTask(id);
  if (!task) return null;
  Object.assign(task, patch);
  persist();
  return task;
}

export function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  persist();
}

export function toggleDone(id) {
  const task = getTask(id);
  if (task) updateTask(id, { done: !task.done });
  return task;
}

export function exportAll() {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks, settings }, null, 2);
}

/** Merge an exported file back in, skipping ids that already exist. */
export function importAll(json) {
  const data = JSON.parse(json);
  const incoming = Array.isArray(data) ? data : data.tasks;
  if (!Array.isArray(incoming)) throw new Error('No tasks in that file');
  const seen = new Set(tasks.map((t) => t.id));
  let added = 0;
  for (const t of incoming) {
    if (!t || !t.title || seen.has(t.id)) continue;
    tasks.push({ ...t, id: t.id || newId() });
    added += 1;
  }
  persist();
  return added;
}

export function clearAll() {
  tasks = [];
  persist();
}
