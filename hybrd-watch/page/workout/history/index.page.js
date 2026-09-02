import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import { DATE_TEXT, NAME_TEXT, DELETE_BUTTON, BACK_BUTTON } from 'zosLoader:./index.page.[pf].layout.js'

function backToHub() {
  replace({ url: 'page/workout/index.page' })
}

Page(
  BasePage({
    onInit(param) {
      const [watchWorkoutId, date, name] = (param || '').split('|')
      this.state = { watchWorkoutId, date, name }
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, { ...DATE_TEXT, text: this.state.date || '' })
      hmUI.createWidget(hmUI.widget.TEXT, { ...NAME_TEXT, text: this.state.name || 'Workout' })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...DELETE_BUTTON,
        click_func: () => {
          this.request({ method: 'DELETE_WORKOUT', params: this.state.watchWorkoutId })
            .then(() => {
              hmUI.showToast({ text: 'Workout deleted' })
              backToHub()
            })
            .catch(() => {
              hmUI.showToast({ text: "Couldn't reach the phone - not deleted" })
            })
        },
      })
      hmUI.createWidget(hmUI.widget.BUTTON, { ...BACK_BUTTON, click_func: () => backToHub() })
    },
    onDestroy() {},
  })
)
