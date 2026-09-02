import { BaseApp } from '@zeppos/zml/base-app'
import { loadPersistedWorkout } from './utils/liveWorkout'

App(
  BaseApp({
    // liveWorkout holds the in-progress workout while the user moves
    // between the group/exercise/set pages logging it - see
    // utils/liveWorkout.js. null when nothing is in progress. Restored
    // below from disk so quitting the app mid-workout doesn't lose it.
    globalData: { liveWorkout: null },
    onCreate() {
      this.globalData.liveWorkout = loadPersistedWorkout()
    },
    onDestroy() {},
  })
)
