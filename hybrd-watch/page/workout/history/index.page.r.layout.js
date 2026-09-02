import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM } from '../../../utils/constants'

export const { width: DEVICE_WIDTH } = getDeviceInfo()

export const DATE_TEXT = {
  text: '',
  x: px(40),
  y: px(120),
  w: DEVICE_WIDTH - px(80),
  h: px(32),
  color: DIM,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const NAME_TEXT = {
  text: '',
  x: px(40),
  y: px(160),
  w: DEVICE_WIDTH - px(80),
  h: px(60),
  color: WHITE,
  text_size: px(30),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

const BUTTON_W = px(280)
const BUTTON_X = Math.floor((DEVICE_WIDTH - BUTTON_W) / 2)

export const DELETE_BUTTON = {
  text: 'Delete Workout',
  x: BUTTON_X,
  y: px(290),
  w: BUTTON_W,
  h: px(54),
  radius: px(27),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0xd85e33,
  text_size: px(24),
}

export const BACK_BUTTON = {
  text: 'Back',
  x: BUTTON_X,
  y: px(356),
  w: BUTTON_W,
  h: px(46),
  radius: px(23),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0x999999,
  text_size: px(20),
}
