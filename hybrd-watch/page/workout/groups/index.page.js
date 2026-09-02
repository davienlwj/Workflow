import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { GROUPS } from '../../../utils/exercises'
import { TITLE_TEXT, LIST_CONFIG } from 'zosLoader:./index.page.[pf].layout.js'

Page(
  BasePage({
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      const dataArray = GROUPS.map((g) => ({ label: g.label, key: g.key }))
      hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...LIST_CONFIG,
        data_array: dataArray,
        data_count: dataArray.length,
        data_type_config: [{ start: 0, end: dataArray.length, type_id: 1 }],
        data_type_config_count: 1,
        item_click_func: (list, index) => {
          // A plain string param, not an object - keeps onInit(param) on the
          // receiving page unambiguous rather than relying on push()'s
          // object-to-string round trip actually coming back parsed.
          push({ url: 'page/workout/exercises/index.page', params: dataArray[index].key })
        },
      })
    },
    onDestroy() {},
  })
)
