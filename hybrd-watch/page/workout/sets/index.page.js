import * as hmUI from '@zos/ui'
import { back } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { EXERCISES } from '../../../utils/exercises'
import { addSet, lastSet, setCountFor } from '../../../utils/liveWorkout'
import {
  TITLE_TEXT,
  WEIGHT_LABEL,
  WEIGHT_VALUE,
  WEIGHT_MINUS,
  WEIGHT_PLUS,
  REPS_LABEL,
  REPS_VALUE,
  REPS_MINUS,
  REPS_PLUS,
  ADD_SET_BUTTON,
  COUNT_TEXT,
  DONE_BUTTON,
} from 'zosLoader:./index.page.[pf].layout.js'

const WEIGHT_STEP = 2.5
const DEFAULT_WEIGHT = 20
const DEFAULT_REPS = 8

Page(
  BasePage({
    state: {
      weight: DEFAULT_WEIGHT,
      reps: DEFAULT_REPS,
    },
    onInit(exerciseId) {
      this.state.exerciseId = exerciseId
      // Same exercise already logged earlier in *this* session - reuse
      // instantly, no round trip needed (the common "another set at the
      // same weight" case).
      const prev = lastSet(exerciseId)
      this.state.weight = prev?.weight ?? DEFAULT_WEIGHT
      this.state.reps = prev?.reps ?? DEFAULT_REPS
      this.state.needsHistoryLookup = !prev
    },
    build() {
      const exercise = EXERCISES.find((e) => e.id === this.state.exerciseId)
      hmUI.createWidget(hmUI.widget.TEXT, { ...TITLE_TEXT, text: exercise ? exercise.name : 'Exercise' })

      hmUI.createWidget(hmUI.widget.TEXT, WEIGHT_LABEL)
      this.state.weightText = hmUI.createWidget(hmUI.widget.TEXT, {
        ...WEIGHT_VALUE,
        text: this.formatWeight(),
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...WEIGHT_MINUS, click_func: () => this.stepWeight(-1) })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...WEIGHT_PLUS, click_func: () => this.stepWeight(1) })

      hmUI.createWidget(hmUI.widget.TEXT, REPS_LABEL)
      this.state.repsText = hmUI.createWidget(hmUI.widget.TEXT, {
        ...REPS_VALUE,
        text: String(this.state.reps),
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...REPS_MINUS, click_func: () => this.stepReps(-1) })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...REPS_PLUS, click_func: () => this.stepReps(1) })

      hmUI.createWidget(hmUI.widget.BUTTON, { ...ADD_SET_BUTTON, click_func: () => this.addSet() })
      this.state.countText = hmUI.createWidget(hmUI.widget.TEXT, {
        ...COUNT_TEXT,
        text: this.countLabel(),
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...DONE_BUTTON, click_func: () => back() })

      // First time this exercise comes up in the session - check past
      // workouts for what was actually lifted last time, so the stepper
      // doesn't start from a generic default. Shown weight/reps update in
      // place if this resolves after the user's already looking at it;
      // fine either way since it's a normal BLE round trip, typically
      // under a second.
      if (this.state.needsHistoryLookup) {
        this.request({ method: 'GET_LAST_SET', params: this.state.exerciseId })
          .then(({ weight, reps }) => {
            if (weight == null && reps == null) return
            if (weight != null) this.state.weight = weight
            if (reps != null) this.state.reps = reps
            this.state.weightText.setProperty(hmUI.prop.TEXT, this.formatWeight())
            this.state.repsText.setProperty(hmUI.prop.TEXT, String(this.state.reps))
          })
          .catch(() => {})
      }
    },
    formatWeight() {
      const w = this.state.weight
      return `${Number.isInteger(w) ? w : w.toFixed(1)} kg`
    },
    countLabel() {
      const n = setCountFor(this.state.exerciseId)
      return `${n} set${n === 1 ? '' : 's'} logged`
    },
    stepWeight(dir) {
      this.state.weight = Math.max(0, Math.round((this.state.weight + dir * WEIGHT_STEP) * 10) / 10)
      this.state.weightText.setProperty(hmUI.prop.TEXT, this.formatWeight())
    },
    stepReps(dir) {
      this.state.reps = Math.max(0, this.state.reps + dir)
      this.state.repsText.setProperty(hmUI.prop.TEXT, String(this.state.reps))
    },
    addSet() {
      addSet(this.state.exerciseId, { weight: this.state.weight, reps: this.state.reps, type: 'normal' })
      this.state.countText.setProperty(hmUI.prop.TEXT, this.countLabel())
      hmUI.showToast({ text: 'Set added' })
    },
    onDestroy() {},
  })
)
