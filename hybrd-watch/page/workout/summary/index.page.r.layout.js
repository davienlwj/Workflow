import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, BRAND_ORANGE } from '../../../utils/constants'

export const { width: DEVICE_WIDTH } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'Workout Saved',
  x: px(20),
  y: px(50),
  w: DEVICE_WIDTH - px(40),
  h: px(36),
  color: BRAND_ORANGE,
  text_size: px(28),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

const ROW_START_Y = 120
const ROW_SPACING = 56

export function statRowStyle(index) {
  return {
    text: '',
    x: px(20),
    y: px(ROW_START_Y + index * ROW_SPACING),
    w: DEVICE_WIDTH - px(40),
    h: px(46),
    color: WHITE,
    text_size: px(26),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
  }
}

export const DONE_BUTTON = {
  text: 'Done',
  x: Math.floor((DEVICE_WIDTH - px(200)) / 2),
  y: px(390),
  w: px(200),
  h: px(50),
  radius: px(25),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(24),
}
