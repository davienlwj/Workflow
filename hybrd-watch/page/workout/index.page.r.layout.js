import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getDeviceInfo } from '@zos/device'
import { WHITE, DIM, BRAND_ORANGE } from '../../utils/constants'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()

export const TITLE_TEXT = {
  text: 'Workouts',
  x: px(20),
  y: px(20),
  w: DEVICE_WIDTH - px(40),
  h: px(32),
  color: DIM,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

// ---- idle state (no workout in progress) ----

export const STATUS_TEXT = {
  text: '',
  x: px(24),
  y: px(170),
  w: DEVICE_WIDTH - px(48),
  h: px(80),
  color: BRAND_ORANGE,
  text_size: px(26),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

const HISTORY_ROW_START_Y = 88
const HISTORY_ROW_SPACING = 50

export function historyRowStyle(index) {
  return {
    text: '',
    x: px(20),
    y: px(HISTORY_ROW_START_Y + index * HISTORY_ROW_SPACING),
    w: DEVICE_WIDTH - px(40),
    h: px(42),
    color: WHITE,
    text_size: px(23),
    align_h: hmUI.align.CENTER_H,
    align_v: hmUI.align.CENTER_V,
    text_style: hmUI.text_style.ELLIPSIS,
  }
}

export const HISTORY_ROW_COUNT = 3

export const IDLE_BUTTON = {
  text: '+ New Workout',
  x: Math.floor((DEVICE_WIDTH - px(240)) / 2),
  y: px(340),
  w: px(240),
  h: px(60),
  radius: px(30),
  normal_color: BRAND_ORANGE,
  press_color: 0xcc561f,
  color: WHITE,
  text_size: px(27),
}

export const SYNC_NOW_BUTTON = {
  text: 'Sync now',
  x: Math.floor((DEVICE_WIDTH - px(160)) / 2),
  y: px(414),
  w: px(160),
  h: px(36),
  radius: px(18),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0x999999,
  text_size: px(18),
}

// ---- in-progress state ----

export const TIMER_TEXT = {
  text: '0:00',
  x: px(30),
  y: px(48),
  w: DEVICE_WIDTH - px(60),
  h: px(70),
  color: WHITE,
  text_size: px(56),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const VOLUME_TEXT = {
  text: '',
  x: px(30),
  y: px(120),
  w: DEVICE_WIDTH - px(60),
  h: px(32),
  color: BRAND_ORANGE,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

export const EXERCISE_LIST_CONFIG = {
  x: px(20),
  y: px(158),
  w: DEVICE_WIDTH - px(40),
  h: px(150),
  item_height: px(64),
  item_space: px(6),
  item_config: [
    {
      type_id: 1,
      item_bg_color: 0x1a1a1a,
      item_bg_radius: px(14),
      text_view: [
        {
          x: px(20),
          y: px(0),
          w: DEVICE_WIDTH - px(80),
          h: px(64),
          key: 'label',
          color: WHITE,
          text_size: px(24),
          align_h: hmUI.align.LEFT,
          align_v: hmUI.align.CENTER_V,
          text_style: hmUI.text_style.ELLIPSIS,
        },
      ],
      text_view_count: 1,
      item_height: px(64),
    },
  ],
  item_config_count: 1,
}

export const EMPTY_EXERCISES_TEXT = {
  text: 'No exercises yet',
  x: px(24),
  y: px(200),
  w: DEVICE_WIDTH - px(48),
  h: px(40),
  color: DIM,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

const HALF_BUTTON_W = px(190)
const HALF_BUTTON_GAP = px(20)
const HALF_BUTTON_START_X = Math.floor((DEVICE_WIDTH - HALF_BUTTON_W * 2 - HALF_BUTTON_GAP) / 2)

export const ADD_EXERCISE_BUTTON = {
  text: '+ Add Exercise',
  x: HALF_BUTTON_START_X,
  y: px(318),
  w: HALF_BUTTON_W,
  h: px(54),
  radius: px(27),
  normal_color: BRAND_ORANGE,
  press_color: 0xcc561f,
  color: WHITE,
  text_size: px(22),
}

export const FINISH_BUTTON = {
  text: 'Finish',
  x: HALF_BUTTON_START_X + HALF_BUTTON_W + HALF_BUTTON_GAP,
  y: px(318),
  w: HALF_BUTTON_W,
  h: px(54),
  radius: px(27),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: WHITE,
  text_size: px(22),
}

export const DISCARD_BUTTON = {
  text: 'Discard workout',
  x: HALF_BUTTON_START_X,
  y: px(382),
  w: HALF_BUTTON_W * 2 + HALF_BUTTON_GAP,
  h: px(38),
  radius: px(19),
  normal_color: 0x1a1a1a,
  press_color: 0x333333,
  color: 0x999999,
  text_size: px(21),
}
