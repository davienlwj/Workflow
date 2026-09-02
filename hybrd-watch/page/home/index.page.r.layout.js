import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, FAINT, BRAND_ORANGE } from '../../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'HYBR.D',
  x: px(40),
  y: px(50),
  w: DEVICE_WIDTH - px(80),
  h: px(36),
  color: DIM,
  text_size: px(26),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const DAYS_TEXT = {
  text: '--',
  x: px(30),
  y: px(120),
  w: DEVICE_WIDTH - px(60),
  h: px(64),
  color: WHITE,
  text_size: px(48),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const DAYS_SUB_TEXT = {
  text: 'since last workout',
  x: px(30),
  y: px(186),
  w: DEVICE_WIDTH - px(60),
  h: px(30),
  color: BRAND_ORANGE,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const LAST_WORKOUT_TEXT = {
  text: '',
  x: px(30),
  y: px(236),
  w: DEVICE_WIDTH - px(60),
  h: px(34),
  color: 0xcccccc,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const WEEK_VOLUME_TEXT = {
  text: '',
  x: px(30),
  y: px(278),
  w: DEVICE_WIDTH - px(60),
  h: px(34),
  color: 0xcccccc,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const STATUS_TEXT = {
  text: '',
  x: px(30),
  y: px(324),
  w: DEVICE_WIDTH - px(60),
  h: px(40),
  color: FAINT,
  text_size: px(18),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

export const WORKOUT_BUTTON = {
  text: 'Workout',
  x: Math.floor((DEVICE_WIDTH - px(220)) / 2),
  y: px(384),
  w: px(220),
  h: px(56),
  radius: px(28),
  normal_color: BRAND_ORANGE,
  press_color: 0xcc561f,
  color: WHITE,
  text_size: px(28),
}
