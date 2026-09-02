import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, BRAND_ORANGE } from '../../../utils/constants'

export const { width: DEVICE_WIDTH } = getDeviceInfo()

export const TITLE_TEXT = {
  text: '',
  x: px(60),
  y: px(18),
  w: DEVICE_WIDTH - px(120),
  h: px(50),
  color: DIM,
  text_size: px(20),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

function stepperLabel(y) {
  return {
    text: '',
    x: px(60),
    y: px(y),
    w: DEVICE_WIDTH - px(120),
    h: px(26),
    color: DIM,
    text_size: px(20),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
  }
}

function stepperValue(y) {
  return {
    text: '',
    x: px(128),
    y: px(y),
    w: px(210),
    h: px(60),
    color: WHITE,
    text_size: px(32),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
  }
}

function stepperButton(x, y, label) {
  return {
    text: label,
    x: px(x),
    y: px(y),
    w: px(64),
    h: px(60),
    radius: px(16),
    normal_color: 0x1a1a1a,
    press_color: 0x333333,
    color: BRAND_ORANGE,
    text_size: px(36),
  }
}

export const WEIGHT_LABEL = { ...stepperLabel(76), text: 'Weight' }
export const WEIGHT_VALUE = stepperValue(104)
export const WEIGHT_MINUS = stepperButton(54, 104, '−')
export const WEIGHT_PLUS = stepperButton(348, 104, '+')

export const REPS_LABEL = { ...stepperLabel(184), text: 'Reps' }
export const REPS_VALUE = stepperValue(212)
export const REPS_MINUS = stepperButton(54, 212, '−')
export const REPS_PLUS = stepperButton(348, 212, '+')

const ACTION_BUTTON_W = px(220)
const ACTION_BUTTON_X = Math.floor((DEVICE_WIDTH - ACTION_BUTTON_W) / 2)

export const ADD_SET_BUTTON = {
  text: 'Add Set',
  x: ACTION_BUTTON_X,
  y: px(290),
  w: ACTION_BUTTON_W,
  h: px(54),
  radius: px(27),
  normal_color: BRAND_ORANGE,
  press_color: 0xcc561f,
  color: WHITE,
  text_size: px(26),
}

export const COUNT_TEXT = {
  text: '',
  x: px(20),
  y: px(352),
  w: DEVICE_WIDTH - px(40),
  h: px(30),
  color: DIM,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const DONE_BUTTON = {
  text: 'Done with this exercise',
  x: ACTION_BUTTON_X - px(20),
  y: px(392),
  w: ACTION_BUTTON_W + px(40),
  h: px(46),
  radius: px(23),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(20),
}
