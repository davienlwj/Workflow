import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    // liveWorkout holds the in-progress workout while the user moves
    // between the group/exercise/set pages logging it - see
    // utils/liveWorkout.js. null when nothing is in progress.
    globalData: { liveWorkout: null },
    onCreate() {},
    onDestroy() {},
  })
)
