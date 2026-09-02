import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { GROUPS, EXERCISES } from '../../../utils/exercises'
import { TITLE_TEXT, LIST_CONFIG } from 'zosLoader:./index.page.[pf].layout.js'

const CREATE_ROW = { label: '+ Create Exercise' }

Page(
  BasePage({
    state: {
      exercises: [],
      list: null,
    },
    onInit(groupKey) {
      this.state.groupKey = groupKey
    },
    build() {
      const isCustom = this.state.groupKey === 'custom'
      const group = GROUPS.find((g) => g.key === this.state.groupKey)
      hmUI.createWidget(hmUI.widget.TEXT, { ...TITLE_TEXT, text: isCustom ? 'Custom' : group ? group.label : 'Exercises' })

      if (isCustom) {
        this.state.exercises = []
        this.buildList()
        // Fetched fresh each visit rather than baked into the app, since
        // custom exercises can be added from either the phone's Watch
        // settings or right here, and this list should reflect whatever's
        // there right now regardless of which.
        this.request({ method: 'GET_CUSTOM_EXERCISES' })
          .then(({ exercises }) => {
            this.state.exercises = exercises
            this.updateList()
          })
          .catch(() => {})
      } else {
        this.state.exercises = EXERCISES.filter((e) => e.group === this.state.groupKey)
        this.buildList()
      }
    },
    dataArray() {
      const rows = this.state.exercises.map((e) => ({ label: e.name }))
      return this.state.groupKey === 'custom' ? [CREATE_ROW, ...rows] : rows
    },
    goToExercise(exercise) {
      // id and name both travel in the param (pipe-delimited) so the
      // sets/manage/hub pages never need to re-look-up a custom exercise's
      // name - only the static built-in library supports that kind of
      // lookup.
      replace({ url: 'page/workout/sets/index.page', params: `${exercise.id}|${exercise.name}` })
    },
    createExercise() {
      hmUI.createKeyboard({
        inputType: hmUI.inputType.CHAR,
        text: '',
        onComplete: (kb, result) => {
          hmUI.deleteKeyboard()
          const name = (result?.data || '').trim()
          if (!name) return
          this.request({ method: 'ADD_CUSTOM_EXERCISE', params: name })
            .then(({ exercise, error }) => {
              if (error || !exercise) {
                hmUI.showToast({ text: error || 'Could not add exercise' })
                return
              }
              this.goToExercise(exercise)
            })
            .catch(() => hmUI.showToast({ text: "Couldn't reach the phone" }))
        },
        onCancel: () => hmUI.deleteKeyboard(),
      })
    },
    buildList() {
      const dataArray = this.dataArray()
      this.state.list = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...LIST_CONFIG,
        data_array: dataArray,
        data_count: dataArray.length,
        data_type_config: [{ start: 0, end: dataArray.length, type_id: 1 }],
        data_type_config_count: 1,
        item_click_func: (list, index) => {
          if (this.state.groupKey === 'custom') {
            if (index === 0) {
              this.createExercise()
              return
            }
            const exercise = this.state.exercises[index - 1]
            if (exercise) this.goToExercise(exercise)
            return
          }
          const exercise = this.state.exercises[index]
          if (exercise) this.goToExercise(exercise)
        },
      })
    },
    updateList() {
      const dataArray = this.dataArray()
      this.state.list.setProperty(hmUI.prop.UPDATE_DATA, {
        data_array: dataArray,
        data_count: dataArray.length,
        data_type_config: [{ start: 0, end: dataArray.length, type_id: 1 }],
        data_type_config_count: 1,
        on_page: 1,
      })
    },
    onDestroy() {},
  })
)
