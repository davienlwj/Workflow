import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  TITLE_TEXT,
  DAYS_TEXT,
  DAYS_SUB_TEXT,
  LAST_WORKOUT_TEXT,
  WEEK_VOLUME_TEXT,
  STATUS_TEXT,
  WORKOUT_BUTTON,
} from 'zosLoader:./index.page.[pf].layout.js'

Page(
  BasePage({
    state: {
      daysText: null,
      lastWorkoutText: null,
      weekVolumeText: null,
      statusText: null,
    },
    onInit() {
      this.refresh()
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      this.state.daysText = hmUI.createWidget(hmUI.widget.TEXT, DAYS_TEXT)
      hmUI.createWidget(hmUI.widget.TEXT, DAYS_SUB_TEXT)
      this.state.lastWorkoutText = hmUI.createWidget(hmUI.widget.TEXT, LAST_WORKOUT_TEXT)
      this.state.weekVolumeText = hmUI.createWidget(hmUI.widget.TEXT, WEEK_VOLUME_TEXT)
      this.state.statusText = hmUI.createWidget(hmUI.widget.TEXT, STATUS_TEXT)
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...WORKOUT_BUTTON,
        click_func: () => push({ url: 'page/workout/index.page' }),
      })
    },
    onShow() {
      this.refresh()
    },
    refresh() {
      this.request({ method: 'GET_LIFT_STATUS' })
        .then((result) => {
          this.state.daysText.setProperty(
            hmUI.prop.TEXT,
            result.daysSinceLastWorkout != null ? String(result.daysSinceLastWorkout) : '--'
          )
          this.state.lastWorkoutText.setProperty(
            hmUI.prop.TEXT,
            result.lastWorkout ? `${result.lastWorkout.name || 'Workout'} · ${result.lastWorkout.exerciseCount} ex` : ''
          )
          this.state.weekVolumeText.setProperty(hmUI.prop.TEXT, `This week · ${result.weekVolume} kg`)
          this.state.statusText.setProperty(
            hmUI.prop.TEXT,
            result.daysSinceLastWorkout == null ? 'No workouts logged yet' : ''
          )
        })
        .catch(() => {
          this.state.daysText.setProperty(hmUI.prop.TEXT, '--')
          this.state.lastWorkoutText.setProperty(hmUI.prop.TEXT, '')
          this.state.weekVolumeText.setProperty(hmUI.prop.TEXT, '')
          this.state.statusText.setProperty(hmUI.prop.TEXT, "Couldn't reach the phone")
        })
    },
    onDestroy() {},
  })
)
