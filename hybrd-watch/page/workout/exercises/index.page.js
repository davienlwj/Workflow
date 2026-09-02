import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { GROUPS, EXERCISES } from '../../../utils/exercises'
import { TITLE_TEXT, LIST_CONFIG } from 'zosLoader:./index.page.[pf].layout.js'

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
        // custom exercises are added from the phone's Watch settings and
        // this list should reflect whatever's there right now.
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
      if (this.state.exercises.length === 0 && this.state.groupKey === 'custom') {
        return [{ label: 'No custom exercises yet - add from phone settings' }]
      }
      return this.state.exercises.map((e) => ({ label: e.name }))
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
          const exercise = this.state.exercises[index]
          if (!exercise) return
          // id and name both travel in the param (pipe-delimited) so the
          // sets/manage/hub pages never need to re-look-up a custom
          // exercise's name - only the static built-in library supports
          // that kind of lookup.
          replace({ url: 'page/workout/sets/index.page', params: `${exercise.id}|${exercise.name}` })
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
