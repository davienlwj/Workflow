import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  TITLE_TEXT,
  VO2MAX_TEXT,
  VO2MAX_SUB_TEXT,
  STAT_ROW_1,
  STAT_ROW_2,
  STAT_ROW_3,
  STATUS_TEXT,
  ZONES_BUTTON,
  WORKOUT_BUTTON,
} from 'zosLoader:./index.page.[pf].layout.js'

function formatDelta(delta) {
  if (delta == null) return ''
  const sign = delta > 0 ? '+' : ''
  return ` ${sign}${delta}`
}

function statusMessage(error) {
  if (error === 'NOT_CONFIGURED') return 'Add your intervals.icu Athlete ID and API Key in the Zepp app settings for this watch face.'
  if (error === 'BAD_CREDENTIALS') return "Couldn't sign in to intervals.icu - check the Athlete ID / API Key."
  if (error === 'NETWORK_ERROR') return "Couldn't reach intervals.icu."
  return ''
}

Page(
  BasePage({
    state: {
      vo2maxText: null,
      vo2maxSub: null,
      statRow1: null,
      statRow2: null,
      statRow3: null,
      statusText: null,
    },
    onInit() {
      this.refresh()
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      this.state.vo2maxText = hmUI.createWidget(hmUI.widget.TEXT, VO2MAX_TEXT)
      this.state.vo2maxSub = hmUI.createWidget(hmUI.widget.TEXT, VO2MAX_SUB_TEXT)
      this.state.statRow1 = hmUI.createWidget(hmUI.widget.TEXT, STAT_ROW_1)
      this.state.statRow2 = hmUI.createWidget(hmUI.widget.TEXT, STAT_ROW_2)
      this.state.statRow3 = hmUI.createWidget(hmUI.widget.TEXT, STAT_ROW_3)
      this.state.statusText = hmUI.createWidget(hmUI.widget.TEXT, STATUS_TEXT)
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...ZONES_BUTTON,
        click_func: () => {
          push({ url: 'page/zones/index.page' })
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...WORKOUT_BUTTON,
        click_func: () => {
          push({ url: 'page/workout/index.page' })
        },
      })
    },
    refresh() {
      this.request({ method: 'GET_STATUS' })
        .then((result) => {
          if (result.error) {
            this.showError(result.error)
            return
          }
          this.state.vo2maxText.setProperty(hmUI.prop.TEXT, result.vo2max != null ? `${result.vo2max}` : '--')
          this.state.vo2maxSub.setProperty(
            hmUI.prop.TEXT,
            `VO2max${formatDelta(result.vo2maxDelta)}`
          )
          this.state.statRow1.setProperty(
            hmUI.prop.TEXT,
            `Resting ${result.restingHR != null ? result.restingHR + ' bpm' : '--'} · Sleep ${result.sleepHours != null ? result.sleepHours + 'h' : '--'}`
          )
          this.state.statRow2.setProperty(
            hmUI.prop.TEXT,
            result.daysSinceLastRun != null
              ? result.daysSinceLastRun === 0
                ? 'Ran today'
                : `${result.daysSinceLastRun}d since last run`
              : 'No runs synced yet'
          )
          this.state.statRow3.setProperty(hmUI.prop.TEXT, `This week · ${result.weekKm} km`)
          this.state.statusText.setProperty(hmUI.prop.TEXT, '')
        })
        .catch(() => {
          this.showError('NETWORK_ERROR')
        })
    },
    showError(error) {
      this.state.vo2maxText.setProperty(hmUI.prop.TEXT, '--')
      this.state.vo2maxSub.setProperty(hmUI.prop.TEXT, 'VO2max')
      this.state.statRow1.setProperty(hmUI.prop.TEXT, '')
      this.state.statRow2.setProperty(hmUI.prop.TEXT, '')
      this.state.statRow3.setProperty(hmUI.prop.TEXT, '')
      this.state.statusText.setProperty(hmUI.prop.TEXT, statusMessage(error))
    },
    onDestroy() {},
  })
)
