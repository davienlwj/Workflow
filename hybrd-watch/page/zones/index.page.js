import * as hmUI from '@zos/ui'
import { BasePage } from '@zeppos/zml/base-page'
import { BRAND_ORANGE, WHITE } from '../../utils/constants'
import {
  TITLE_TEXT,
  SUBTITLE_TEXT,
  zoneRowStyle,
  ZONE_ROW_COUNT,
} from 'zosLoader:./index.page.[pf].layout.js'

const MODEL_LABEL = { lthr: 'LTHR-based', rhr: 'Resting-HR (Karvonen)' }

Page(
  BasePage({
    state: {
      subtitle: null,
      rows: [],
    },
    onInit() {
      this.request({ method: 'GET_ZONES' })
        .then((result) => this.render(result))
        .catch(() => {
          this.state.subtitle.setProperty(hmUI.prop.TEXT, "Couldn't load zones")
        })
    },
    build() {
      hmUI.createWidget(hmUI.widget.TEXT, TITLE_TEXT)
      this.state.subtitle = hmUI.createWidget(hmUI.widget.TEXT, SUBTITLE_TEXT)
      for (let i = 0; i < ZONE_ROW_COUNT; i++) {
        this.state.rows.push(hmUI.createWidget(hmUI.widget.TEXT, zoneRowStyle(i)))
      }
    },
    render({ model, zones }) {
      this.state.subtitle.setProperty(hmUI.prop.TEXT, MODEL_LABEL[model] || '')
      zones.forEach((zone, i) => {
        const row = this.state.rows[i]
        if (!row) return
        row.setProperty(hmUI.prop.MORE, {
          text: `${zone.target ? '▸ ' : ''}${zone.name}  ${zone.low}–${zone.high}`,
          color: zone.target ? BRAND_ORANGE : WHITE,
        })
      })
    },
    onDestroy() {},
  })
)
