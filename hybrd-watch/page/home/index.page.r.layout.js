import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, FAINT, BRAND_ORANGE } from '../../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'HYBR.D',
  x: px(40),
  y: px(40),
  w: DEVICE_WIDTH - px(80),
  h: px(36),
  color: DIM,
  text_size: px(26),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const VO2MAX_TEXT = {
  text: '--',
  x: px(40),
  y: px(84),
  w: DEVICE_WIDTH - px(80),
  h: px(96),
  color: WHITE,
  text_size: px(84),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const VO2MAX_SUB_TEXT = {
  text: 'VO2max',
  x: px(40),
  y: px(180),
  w: DEVICE_WIDTH - px(80),
  h: px(32),
  color: BRAND_ORANGE,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

function statRow(y) {
  return {
    x: px(40),
    y: px(y),
    w: DEVICE_WIDTH - px(80),
    h: px(36),
    color: 0xcccccc,
    text_size: px(28),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
    text_style: hmUI.text_style.NONE,
  }
}

export const STAT_ROW_1 = { ...statRow(240), text: '' } // resting HR / sleep
export const STAT_ROW_2 = { ...statRow(280), text: '' } // days since last run
export const STAT_ROW_3 = { ...statRow(320), text: '' } // week km

export const STATUS_TEXT = {
  text: '',
  x: px(30),
  y: px(360),
  w: DEVICE_WIDTH - px(60),
  h: px(30),
  color: FAINT,
  text_size: px(18),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

export const ZONES_BUTTON = {
  text: 'HR Zones',
  x: Math.floor((DEVICE_WIDTH - px(200)) / 2),
  y: px(396),
  w: px(200),
  h: px(56),
  radius: px(28),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(28),
}
