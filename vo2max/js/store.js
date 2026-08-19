/*
 * localStorage persistence for the VO2max tracker.
 * Two keys: settings (a single object) and sessions (an array), each versioned
 * so a future shape change can migrate instead of silently losing data.
 */

const SETTINGS_KEY = 'vo2max.settings.v1';
const SESSIONS_KEY = 'vo2max.sessions.v1';

export const DEFAULT_SETTINGS = {
  baselineVO2max: 46,
  baselineDate: '2026-08-16',
  device: 'Amazfit T-Rex 3 Pro (Zepp app)',
  restingHR: 54,
  maxHR: 194,
  lthr: 181,
  protocolStartDate: '2026-08-19',
  primaryZoneModel: 'lthr', // 'lthr' | 'rhr'
  protocol: {
    reps: 4,
    workMin: 4,
    restMin: 3,
    warmupMin: 10,
    cooldownMin: 8,
    freqPerWeek: 2,
    blockWeeks: 8,
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

export function exportAll() {
  return JSON.stringify({
    settings: loadSettings(),
    sessions: loadSessions(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export function importAll(json) {
  const data = JSON.parse(json);
  if (data.settings) saveSettings({ ...clone(DEFAULT_SETTINGS), ...data.settings });
  if (Array.isArray(data.sessions)) saveSessions(data.sessions);
}
