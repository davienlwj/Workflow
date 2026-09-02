import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, BRAND_ORANGE } from '../../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'HR Zones',
  x: px(20),
  y: px(36),
  w: DEVICE_WIDTH - px(40),
  h: px(36),
  color: WHITE,
  text_size: px(30),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const SUBTITLE_TEXT = {
  text: '',
  x: px(20),
  y: px(76),
  w: DEVICE_WIDTH - px(40),
  h: px(28),
  color: BRAND_ORANGE,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

const ROW_START_Y = 130
const ROW_SPACING = 56

export function zoneRowStyle(index) {
  return {
    text: '',
    x: px(20),
    y: px(ROW_START_Y + index * ROW_SPACING),
    w: DEVICE_WIDTH - px(40),
    h: px(40),
    color: WHITE,
    text_size: px(26),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
  }
}

export const ZONE_ROW_COUNT = 5
