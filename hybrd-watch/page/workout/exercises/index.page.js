import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { GROUPS, EXERCISES } from '../../../utils/exercises'
import { TITLE_TEXT, LIST_CONFIG } from 'zosLoader:./index.page.[pf].layout.js'

Page(
  BasePage({
    state: {
      exercises: [],
    },
    onInit(groupKey) {
      this.state.groupKey = groupKey
      this.state.exercises = EXERCISES.filter((e) => e.group === groupKey)
    },
    build() {
      const group = GROUPS.find((g) => g.key === this.state.groupKey)
      hmUI.createWidget(hmUI.widget.TEXT, { ...TITLE_TEXT, text: group ? group.label : 'Exercises' })

      const dataArray = this.state.exercises.map((e) => ({ label: e.name, id: e.id }))
      hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...LIST_CONFIG,
        data_array: dataArray,
        data_count: dataArray.length,
        data_type_config: [{ start: 0, end: dataArray.length, type_id: 1 }],
        data_type_config_count: 1,
        item_click_func: (list, index) => {
          push({ url: 'page/workout/sets/index.page', params: dataArray[index].id })
        },
      })
    },
    onDestroy() {},
  })
)
