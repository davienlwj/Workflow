import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { getLiveWorkout, moveExercise, removeExercise, toggleSupersetWithNext } from '../../../utils/liveWorkout'
import {
  TITLE_TEXT,
  SUBTITLE_TEXT,
  ADD_SETS_BUTTON,
  MOVE_UP_BUTTON,
  MOVE_DOWN_BUTTON,
  SUPERSET_BUTTON,
  REMOVE_BUTTON,
  BACK_BUTTON,
} from 'zosLoader:./index.page.[pf].layout.js'

function backToHub() {
  replace({ url: 'page/workout/index.page' })
}

Page(
  BasePage({
    state: {
      index: 0,
    },
    onInit(param) {
      this.state.index = Number(param) || 0
    },
    build() {
      const workout = getLiveWorkout()
      const exercise = workout?.exercises[this.state.index]

      hmUI.createWidget(hmUI.widget.TEXT, { ...TITLE_TEXT, text: exercise ? exercise.name : 'Exercise' })
      this.state.subtitleText = hmUI.createWidget(hmUI.widget.TEXT, SUBTITLE_TEXT)

      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...ADD_SETS_BUTTON,
        click_func: () => {
          const current = getLiveWorkout()?.exercises[this.state.index]
          if (current) replace({ url: 'page/workout/sets/index.page', params: `${current.exerciseId}|${current.name}` })
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...MOVE_UP_BUTTON,
        click_func: () => {
          moveExercise(this.state.index, -1)
          this.state.index = Math.max(0, this.state.index - 1)
          this.refresh()
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...MOVE_DOWN_BUTTON,
        click_func: () => {
          const before = getLiveWorkout()?.exercises.length ?? 0
          moveExercise(this.state.index, 1)
          if (this.state.index < before - 1) this.state.index += 1
          this.refresh()
        },
      })
      this.state.supersetBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...SUPERSET_BUTTON,
        click_func: () => {
          toggleSupersetWithNext(this.state.index)
          this.refresh()
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...REMOVE_BUTTON,
        click_func: () => {
          removeExercise(this.state.index)
          backToHub()
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...BACK_BUTTON, click_func: () => backToHub() })

      this.refresh()
    },
    refresh() {
      const workout = getLiveWorkout()
      const exercise = workout?.exercises[this.state.index]
      this.state.subtitleText.setProperty(
        hmUI.prop.TEXT,
        exercise ? `${exercise.sets.length} set${exercise.sets.length === 1 ? '' : 's'}` : ''
      )
      const next = workout?.exercises[this.state.index + 1]
      let label
      if (!next) label = 'No next exercise to pair'
      else label = exercise?.supersetId && exercise.supersetId === next.supersetId ? 'Un-pair superset' : 'Superset with next'
      this.state.supersetBtn.setProperty(hmUI.prop.TEXT, label)
    },
    onDestroy() {},
  })
)
