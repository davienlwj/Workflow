import * as hmUI from '@zos/ui'
import { push, replace } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  getLiveWorkout,
  startLiveWorkout,
  discardLiveWorkout,
  finishLiveWorkout,
  totalSetCount,
  totalVolume,
  elapsedMs,
  formatDuration,
} from '../../utils/liveWorkout'
import {
  TITLE_TEXT,
  STATUS_TEXT,
  historyRowStyle,
  HISTORY_ROW_COUNT,
  TIMER_TEXT,
  VOLUME_TEXT,
  EXERCISE_LIST_CONFIG,
  EMPTY_EXERCISES_TEXT,
  IDLE_BUTTON,
  SYNC_NOW_BUTTON,
  ADD_EXERCISE_BUTTON,
  FINISH_BUTTON,
  DISCARD_BUTTON,
} from 'zosLoader:./index.page.[pf].layout.js'

function exerciseLabel(exercise) {
  const tag = exercise.supersetId ? ' · superset' : ''
  return `${exercise.name} · ${exercise.sets.length} set${exercise.sets.length === 1 ? '' : 's'}${tag}`
}

Page(
  BasePage({
    state: {
      dynamicWidgets: [],
      history: [],
      timerInterval: null,
    },
    onInit() {
      this.loadHistory()
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      this.render()
    },
    onShow() {
      this.render()
    },
    onHide() {
      this.stopTimer()
    },
    loadHistory() {
      this.request({ method: 'GET_WORKOUTS' })
        .then(({ workouts }) => {
          this.state.history = workouts
          this.render()
        })
        .catch(() => {})
    },
    stopTimer() {
      if (this.state.timerInterval != null) {
        clearInterval(this.state.timerInterval)
        this.state.timerInterval = null
      }
    },
    render() {
      this.stopTimer()
      this.state.dynamicWidgets.forEach((w) => hmUI.deleteWidget(w))
      this.state.dynamicWidgets = []

      const workout = getLiveWorkout()
      if (workout) this.renderInProgress(workout)
      else this.renderIdle()
    },
    renderInProgress(workout) {
      const timerText = hmUI.createWidget(hmUI.widget.TEXT, {
        ...TIMER_TEXT,
        text: formatDuration(elapsedMs()),
      })
      const volumeText = hmUI.createWidget(hmUI.widget.TEXT, {
        ...VOLUME_TEXT,
        text: `${totalVolume()} kg volume`,
      })
      this.state.dynamicWidgets.push(timerText, volumeText)
      this.state.timerInterval = setInterval(() => {
        timerText.setProperty(hmUI.prop.TEXT, formatDuration(elapsedMs()))
      }, 1000)

      if (workout.exercises.length === 0) {
        this.state.dynamicWidgets.push(hmUI.createWidget(hmUI.widget.TEXT, EMPTY_EXERCISES_TEXT))
      } else {
        const dataArray = workout.exercises.map((e) => ({ label: exerciseLabel(e) }))
        const list = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
          ...EXERCISE_LIST_CONFIG,
          data_array: dataArray,
          data_count: dataArray.length,
          data_type_config: [{ start: 0, end: dataArray.length, type_id: 1 }],
          data_type_config_count: 1,
          item_click_func: (list_, index) => {
            replace({ url: 'page/workout/manage/index.page', params: String(index) })
          },
        })
        this.state.dynamicWidgets.push(list)
      }

      this.state.dynamicWidgets.push(
        hmUI.createWidget(hmUI.widget.BUTTON, {
          ...ADD_EXERCISE_BUTTON,
          click_func: () => replace({ url: 'page/workout/groups/index.page' }),
        }),
        hmUI.createWidget(hmUI.widget.BUTTON, {
          ...FINISH_BUTTON,
          click_func: () => this.finish(),
        }),
        hmUI.createWidget(hmUI.widget.BUTTON, {
          ...DISCARD_BUTTON,
          click_func: () => {
            discardLiveWorkout()
            this.render()
          },
        })
      )
    },
    renderIdle() {
      const rows = this.state.history.slice(0, HISTORY_ROW_COUNT)
      if (rows.length === 0) {
        this.state.dynamicWidgets.push(
          hmUI.createWidget(hmUI.widget.TEXT, { ...STATUS_TEXT, text: 'No workouts logged yet' })
        )
      } else {
        rows.forEach((w, i) => {
          this.state.dynamicWidgets.push(
            hmUI.createWidget(hmUI.widget.TEXT, {
              ...historyRowStyle(i),
              text: `${w.date}  ${w.name || 'Workout'} · ${w.exerciseCount} ex · ${w.setCount} sets`,
            })
          )
        })
      }
      this.state.dynamicWidgets.push(
        hmUI.createWidget(hmUI.widget.BUTTON, {
          ...IDLE_BUTTON,
          click_func: () => {
            // Straight to picking the first exercise, skipping the empty
            // "0 exercises" in-progress screen this would otherwise land on.
            startLiveWorkout()
            replace({ url: 'page/workout/groups/index.page' })
          },
        }),
        hmUI.createWidget(hmUI.widget.BUTTON, {
          ...SYNC_NOW_BUTTON,
          click_func: () => this.syncNow(),
        })
      )
    },
    syncNow() {
      hmUI.showToast({ text: 'Syncing…' })
      this.request({ method: 'SYNC_NOW' })
        .then(({ syncError }) => {
          hmUI.showToast({ text: syncError ? `Sync failed: ${syncError}` : 'Synced to Gist' })
        })
        .catch(() => hmUI.showToast({ text: "Couldn't reach the phone" }))
    },
    finish() {
      const workout = getLiveWorkout()
      if (!workout) return
      const summaryParams = [elapsedMs(), totalVolume(), workout.exercises.length, totalSetCount()].join('|')
      const finished = finishLiveWorkout()
      if (!finished) return
      this.request({ method: 'SAVE_WORKOUT', params: finished })
        .then(({ syncError }) => {
          if (syncError) hmUI.showToast({ text: `Saved, but sync failed: ${syncError}` })
        })
        .catch(() => {
          hmUI.showToast({ text: "Couldn't reach the phone - workout not saved" })
        })
      this.render()
      push({ url: 'page/workout/summary/index.page', params: summaryParams })
    },
    onDestroy() {
      this.stopTimer()
    },
  })
)
