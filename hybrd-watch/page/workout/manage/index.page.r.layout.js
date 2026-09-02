import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, BRAND_ORANGE } from '../../../utils/constants'

export const { width: DEVICE_WIDTH } = getDeviceInfo()

export const TITLE_TEXT = {
  text: '',
  x: px(40),
  y: px(14),
  w: DEVICE_WIDTH - px(80),
  h: px(56),
  color: WHITE,
  text_size: px(26),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

export const SUBTITLE_TEXT = {
  text: '',
  x: px(40),
  y: px(74),
  w: DEVICE_WIDTH - px(80),
  h: px(28),
  color: DIM,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

const FULL_W = px(300)
const FULL_X = Math.floor((DEVICE_WIDTH - FULL_W) / 2)
const HALF_W = px(140)
const HALF_GAP = px(20)
const HALF_START_X = Math.floor((DEVICE_WIDTH - HALF_W * 2 - HALF_GAP) / 2)

export const ADD_SETS_BUTTON = {
  text: 'Add Sets',
  x: FULL_X,
  y: px(114),
  w: FULL_W,
  h: px(56),
  radius: px(28),
  normal_color: BRAND_ORANGE,
  press_color: 0xcc561f,
  color: WHITE,
  text_size: px(25),
}

export const MOVE_UP_BUTTON = {
  text: 'Move Up',
  x: HALF_START_X,
  y: px(182),
  w: HALF_W,
  h: px(50),
  radius: px(25),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(20),
}

export const MOVE_DOWN_BUTTON = {
  text: 'Move Down',
  x: HALF_START_X + HALF_W + HALF_GAP,
  y: px(182),
  w: HALF_W,
  h: px(50),
  radius: px(25),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(20),
}

export const SUPERSET_BUTTON = {
  text: '',
  x: FULL_X,
  y: px(244),
  w: FULL_W,
  h: px(50),
  radius: px(25),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(21),
}

export const REMOVE_BUTTON = {
  text: 'Remove Exercise',
  x: FULL_X,
  y: px(306),
  w: FULL_W,
  h: px(50),
  radius: px(25),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0xd85e33,
  text_size: px(22),
}

export const BACK_BUTTON = {
  text: 'Back',
  x: FULL_X,
  y: px(368),
  w: FULL_W,
  h: px(46),
  radius: px(23),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0x999999,
  text_size: px(20),
}
