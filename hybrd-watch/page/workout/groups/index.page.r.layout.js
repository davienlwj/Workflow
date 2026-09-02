import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM } from '../../../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'Muscle Group',
  x: px(20),
  y: px(20),
  w: DEVICE_WIDTH - px(40),
  h: px(40),
  color: DIM,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const LIST_CONFIG = {
  x: px(20),
  y: px(70),
  w: DEVICE_WIDTH - px(40),
  h: DEVICE_HEIGHT - px(90),
  item_height: px(76),
  item_space: px(6),
  item_config: [
    {
      type_id: 1,
      item_bg_color: 0x1a1a1a,
      item_bg_radius: px(16),
      text_view: [
        {
          x: px(24),
          y: px(0),
          w: DEVICE_WIDTH - px(88),
          h: px(76),
          key: 'label',
          color: WHITE,
          text_size: px(28),
          align_h: hmUI.align.LEFT,
          align_v: hmUI.align.CENTER_V,
        },
      ],
      text_view_count: 1,
      item_height: px(76),
    },
  ],
  item_config_count: 1,
}
