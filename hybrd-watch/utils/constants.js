// Defaults mirror vo2max/js/store.js's DEFAULT_SETTINGS, so a watch that
// hasn't been configured yet agrees with a freshly-installed phone app.
export const DEFAULT_SETTINGS = {
  baselineVO2max: 46,
  baselineDate: '2026-08-16',
  restingHR: 54,
  maxHR: 194,
  lthr: 181,
  primaryZoneModel: 'lthr', // 'lthr' | 'rhr'
  intervalsAthleteId: '',
  intervalsApiKey: '',
  gistId: '',
  githubToken: '',
}

export const MAX_WORKOUT_HISTORY = 20 // oldest trimmed off locally once exceeded

export const BRAND_ORANGE = 0xff6c2d
export const WHITE = 0xffffff
export const DIM = 0x999999
export const FAINT = 0x666666
