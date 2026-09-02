import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_SETTINGS } from '../utils/constants'
import { zoneTable } from '../utils/zones'
import { fetchLatestWellness, fetchRunStatus } from './intervals'

function getSettings() {
  const settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const raw = settingsLib.getItem(key)
    if (raw == null || raw === '') continue
    settings[key] = typeof DEFAULT_SETTINGS[key] === 'number' ? Number(raw) : raw
  }
  return settings
}

async function getStatus(res) {
  const settings = getSettings()
  if (!settings.intervalsAthleteId || !settings.intervalsApiKey) {
    res(null, { error: 'NOT_CONFIGURED' })
    return
  }
  try {
    const [wellness, runStatus] = await Promise.all([
      fetchLatestWellness(settings.intervalsAthleteId, settings.intervalsApiKey),
      fetchRunStatus(settings.intervalsAthleteId, settings.intervalsApiKey),
    ])
    const vo2max = wellness.vo2max
    res(null, {
      vo2max,
      vo2maxDelta: vo2max != null ? Math.round((vo2max - settings.baselineVO2max) * 10) / 10 : null,
      restingHR: wellness.restingHR,
      sleepHours: wellness.sleepHours,
      daysSinceLastRun: runStatus.daysSinceLastRun,
      weekKm: runStatus.weekKm,
      syncedAt: Date.now(),
    })
  } catch (err) {
    res(null, { error: err.status === 401 || err.status === 403 ? 'BAD_CREDENTIALS' : 'NETWORK_ERROR' })
  }
}

function getZones(res) {
  const settings = getSettings()
  const table = zoneTable(settings, settings.primaryZoneModel)
  res(null, {
    model: settings.primaryZoneModel,
    zones: table.map((z) => ({ name: z.name, low: z.bpmLow, high: z.bpmHigh, target: !!z.target })),
  })
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRequest(req, res) {
      if (req.method === 'GET_STATUS') {
        getStatus(res)
      } else if (req.method === 'GET_ZONES') {
        getZones(res)
      }
    },
    onRun() {},
    onDestroy() {},
  })
)
