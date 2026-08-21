/*
 * localStorage persistence for the VO2max tracker.
 * Three keys: settings (a single object), sessions (an array) and workouts
 * (an array), each versioned so a future shape change can migrate instead
 * of silently losing data.
 */

const SETTINGS_KEY = 'vo2max.settings.v1';
const SESSIONS_KEY = 'vo2max.sessions.v1';
const WORKOUTS_KEY = 'vo2max.workouts.v1';
const CUSTOM_EXERCISES_KEY = 'vo2max.customExercises.v1';
const LIVE_WORKOUT_KEY = 'vo2max.liveWorkout.v1';

export const DEFAULT_SETTINGS = {
  profile: {
    name: '',
    dob: '',
    heightCm: null,
    weightKg: null,
  },
  baselineVO2max: 46,
  baselineDate: '2026-08-16',
  device: 'Amazfit T-Rex 3 Pro (Zepp app)',
  restingHR: 54,
  maxHR: 194,
  lthr: 181,
  primaryZoneModel: 'lthr', // 'lthr' | 'rhr'
  protocol: {
    reps: 4,
    workMin: 4,
    restMin: 3,
    warmupMin: 10,
    cooldownMin: 8,
    freqPerWeek: 2,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return clone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    // Merge over defaults so a settings shape added later still has a value.
    return {
      ...clone(DEFAULT_SETTINGS),
      ...parsed,
      profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
      protocol: { ...DEFAULT_SETTINGS.protocol, ...(parsed.protocol || {}) },
    };
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  const defaults = clone(DEFAULT_SETTINGS);
  saveSettings(defaults);
  return defaults;
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addSession(session) {
  const sessions = loadSessions();
  const record = { id: makeId(), ...session };
  sessions.push(record);
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  saveSessions(sessions);
  return record;
}

export function updateSession(id, patch) {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sessions[idx] = { ...sessions[idx], ...patch, id };
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  saveSessions(sessions);
  return sessions[idx];
}

export function deleteSession(id) {
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

export function loadWorkouts() {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkouts(workouts) {
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export function addWorkout(workout) {
  const workouts = loadWorkouts();
  const record = { id: makeId(), ...workout };
  workouts.push(record);
  workouts.sort((a, b) => a.date.localeCompare(b.date));
  saveWorkouts(workouts);
  return record;
}

export function updateWorkout(id, patch) {
  const workouts = loadWorkouts();
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  workouts[idx] = { ...workouts[idx], ...patch, id };
  workouts.sort((a, b) => a.date.localeCompare(b.date));
  saveWorkouts(workouts);
  return workouts[idx];
}

export function deleteWorkout(id) {
  const workouts = loadWorkouts().filter((w) => w.id !== id);
  saveWorkouts(workouts);
}

/** User-created exercises, layered on top of the built-in library in js/exercises.js. */
export function loadCustomExercises() {
  try {
    const raw = localStorage.getItem(CUSTOM_EXERCISES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomExercises(exercises) {
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}

export function addCustomExercise(exercise) {
  const exercises = loadCustomExercises();
  const record = { id: `custom-${makeId()}`, ...exercise };
  exercises.push(record);
  saveCustomExercises(exercises);
  return record;
}

export function deleteCustomExercise(id) {
  const exercises = loadCustomExercises().filter((e) => e.id !== id);
  saveCustomExercises(exercises);
}

/** In-progress "today's workout" live session, so backgrounding/killing the
 *  PWA mid-workout at the gym doesn't lose it. Shape: { startedAt, date,
 *  name, notes, exercises } - same as readWorkoutForm()'s output plus
 *  startedAt, with each set also carrying a `done` flag. */
export function loadLiveWorkout() {
  try {
    const raw = localStorage.getItem(LIVE_WORKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLiveWorkout(session) {
  localStorage.setItem(LIVE_WORKOUT_KEY, JSON.stringify(session));
}

export function clearLiveWorkout() {
  localStorage.removeItem(LIVE_WORKOUT_KEY);
}

export function exportAll() {
  return JSON.stringify({
    settings: loadSettings(),
    sessions: loadSessions(),
    workouts: loadWorkouts(),
    customExercises: loadCustomExercises(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importAll(json) {
  const data = JSON.parse(json);
  if (data.settings) saveSettings({ ...clone(DEFAULT_SETTINGS), ...data.settings });
  if (Array.isArray(data.sessions)) saveSessions(data.sessions);
  if (Array.isArray(data.workouts)) saveWorkouts(data.workouts);
  if (Array.isArray(data.customExercises)) saveCustomExercises(data.customExercises);
}
