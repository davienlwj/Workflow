import * as hmUI from '@zos/ui'
import { back } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { formatDuration } from '../../../utils/liveWorkout'
import { TITLE_TEXT, statRowStyle, DONE_BUTTON } from 'zosLoader:./index.page.[pf].layout.js'

Page(
  BasePage({
    onInit(param) {
      const [durationMs, volume, exerciseCount, setCount] = (param || '').split('|').map(Number)
      this.stats = [
        `Time · ${formatDuration(durationMs || 0)}`,
        `Volume · ${volume || 0} kg`,
        `${exerciseCount || 0} exercise${exerciseCount === 1 ? '' : 's'}`,
        `${setCount || 0} set${setCount === 1 ? '' : 's'}`,
      ]
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      this.stats.forEach((text, i) => {
        hmUI.createWidget(hmUI.widget.TEXT, { ...statRowStyle(i), text })
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...DONE_BUTTON, click_func: () => back() })
    },
    onDestroy() {},
  })
)
