/*
 * Exercise library for the watch's exercise picker, generated from
 * ../../vo2max/js/exercises.js (id, name, and a precomputed primary
 * "group" per exercise - the RADAR_GROUP_FOR rollup of muscles[0],
 * matching how that file's radar chart already groups them). Ids must
 * stay identical to the phone app's for a synced workout's exerciseId
 * to resolve there. Custom exercises added on the phone aren't
 * included - only the built-in library is loggable from the watch.
 *
 * Regenerate by re-running the generator this file's history came
 * from against a changed vo2max/js/exercises.js, rather than hand-editing.
 */

export const GROUPS = [
  {
    "key": "chest",
    "label": "Chest"
  },
  {
    "key": "back",
    "label": "Back"
  },
  {
    "key": "shoulders",
    "label": "Shoulders"
  },
  {
    "key": "arms",
    "label": "Arms"
  },
  {
    "key": "quads",
    "label": "Quads"
  },
  {
    "key": "hamstrings",
    "label": "Hamstrings"
  },
  {
    "key": "glutes",
    "label": "Glutes"
  },
  {
    "key": "calves",
    "label": "Calves"
  },
  {
    "key": "abs",
    "label": "Abs"
  },
  {
    "key": "core",
    "label": "Core"
  }
]

export const EXERCISES = [
  {
    "id": "incline-bench-press",
    "name": "Incline Bench Press",
    "group": "chest"
  },
  {
    "id": "incline-dumbbell-press",
    "name": "Incline Dumbbell Press",
    "group": "chest"
  },
  {
    "id": "incline-dumbbell-fly",
    "name": "Incline Dumbbell Fly",
    "group": "chest"
  },
  {
    "id": "low-to-high-cable-fly",
    "name": "Low-to-High Cable Fly",
    "group": "chest"
  },
  {
    "id": "incline-push-up",
    "name": "Incline Push-up",
    "group": "chest"
  },
  {
    "id": "landmine-press",
    "name": "Landmine Press",
    "group": "chest"
  },
  {
    "id": "bench-press",
    "name": "Bench Press",
    "group": "chest"
  },
  {
    "id": "dumbbell-press",
    "name": "Dumbbell Bench Press",
    "group": "chest"
  },
  {
    "id": "push-up",
    "name": "Push-up",
    "group": "chest"
  },
  {
    "id": "chest-fly",
    "name": "Chest Fly",
    "group": "chest"
  },
  {
    "id": "cable-crossover",
    "name": "Cable Crossover",
    "group": "chest"
  },
  {
    "id": "machine-chest-press",
    "name": "Machine Chest Press",
    "group": "chest"
  },
  {
    "id": "pec-deck-fly",
    "name": "Pec Deck Fly",
    "group": "chest"
  },
  {
    "id": "dip",
    "name": "Dip",
    "group": "chest"
  },
  {
    "id": "assisted-chest-dip",
    "name": "Assisted Chest Dip",
    "group": "chest"
  },
  {
    "id": "decline-bench-press",
    "name": "Decline Bench Press",
    "group": "chest"
  },
  {
    "id": "decline-dumbbell-press",
    "name": "Decline Dumbbell Press",
    "group": "chest"
  },
  {
    "id": "high-to-low-cable-fly",
    "name": "High-to-Low Cable Fly",
    "group": "chest"
  },
  {
    "id": "decline-push-up",
    "name": "Decline Push-up",
    "group": "chest"
  },
  {
    "id": "overhead-press",
    "name": "Overhead Press",
    "group": "shoulders"
  },
  {
    "id": "dumbbell-shoulder-press",
    "name": "Dumbbell Shoulder Press",
    "group": "shoulders"
  },
  {
    "id": "arnold-press",
    "name": "Arnold Press",
    "group": "shoulders"
  },
  {
    "id": "front-raise",
    "name": "Front Raise",
    "group": "shoulders"
  },
  {
    "id": "cable-front-raise",
    "name": "Cable Front Raise",
    "group": "shoulders"
  },
  {
    "id": "lateral-raise",
    "name": "Lateral Raise",
    "group": "shoulders"
  },
  {
    "id": "cable-lateral-raise",
    "name": "Cable Lateral Raise",
    "group": "shoulders"
  },
  {
    "id": "machine-lateral-raise",
    "name": "Machine Lateral Raise",
    "group": "shoulders"
  },
  {
    "id": "cable-y-raise",
    "name": "Cable Y-Raise",
    "group": "shoulders"
  },
  {
    "id": "rear-delt-fly",
    "name": "Rear Delt Fly",
    "group": "shoulders"
  },
  {
    "id": "face-pull",
    "name": "Face Pull",
    "group": "shoulders"
  },
  {
    "id": "reverse-pec-deck",
    "name": "Reverse Pec Deck",
    "group": "shoulders"
  },
  {
    "id": "cable-rear-delt-fly",
    "name": "Cable Rear Delt Fly",
    "group": "shoulders"
  },
  {
    "id": "bent-over-rear-delt-raise",
    "name": "Bent-Over Rear Delt Raise",
    "group": "shoulders"
  },
  {
    "id": "barbell-shrug",
    "name": "Barbell Shrug",
    "group": "back"
  },
  {
    "id": "dumbbell-shrug",
    "name": "Dumbbell Shrug",
    "group": "back"
  },
  {
    "id": "upright-row",
    "name": "Upright Row",
    "group": "back"
  },
  {
    "id": "snatch-grip-high-pull",
    "name": "Snatch-Grip High Pull",
    "group": "back"
  },
  {
    "id": "pull-up",
    "name": "Pull-up",
    "group": "back"
  },
  {
    "id": "chin-up",
    "name": "Chin-up",
    "group": "back"
  },
  {
    "id": "assisted-pull-up-wide-grip",
    "name": "Assisted Pull Up (Wide Grip)",
    "group": "back"
  },
  {
    "id": "assisted-pull-up-neutral-grip",
    "name": "Assisted Pull Up (Neutral Grip)",
    "group": "back"
  },
  {
    "id": "lat-pulldown",
    "name": "Lat Pulldown",
    "group": "back"
  },
  {
    "id": "wide-grip-lat-pulldown",
    "name": "Wide-Grip Lat Pulldown",
    "group": "back"
  },
  {
    "id": "straight-arm-pulldown",
    "name": "Straight-Arm Pulldown",
    "group": "back"
  },
  {
    "id": "v-bar-pulldown",
    "name": "V-Bar Lat Pulldown",
    "group": "back"
  },
  {
    "id": "barbell-row",
    "name": "Barbell Row",
    "group": "back"
  },
  {
    "id": "seated-cable-row",
    "name": "Seated Cable Row",
    "group": "back"
  },
  {
    "id": "dumbbell-row",
    "name": "One-Arm Dumbbell Row",
    "group": "back"
  },
  {
    "id": "t-bar-row",
    "name": "T-Bar Row",
    "group": "back"
  },
  {
    "id": "chest-supported-row",
    "name": "Chest-Supported Row",
    "group": "back"
  },
  {
    "id": "machine-row",
    "name": "Machine Row",
    "group": "back"
  },
  {
    "id": "deadlift",
    "name": "Deadlift",
    "group": "back"
  },
  {
    "id": "back-extension",
    "name": "Back Extension",
    "group": "back"
  },
  {
    "id": "superman",
    "name": "Superman",
    "group": "back"
  },
  {
    "id": "barbell-curl",
    "name": "Barbell Curl",
    "group": "arms"
  },
  {
    "id": "dumbbell-curl",
    "name": "Dumbbell Curl",
    "group": "arms"
  },
  {
    "id": "hammer-curl",
    "name": "Hammer Curl",
    "group": "arms"
  },
  {
    "id": "preacher-curl",
    "name": "Preacher Curl",
    "group": "arms"
  },
  {
    "id": "cable-curl",
    "name": "Cable Curl",
    "group": "arms"
  },
  {
    "id": "incline-dumbbell-curl",
    "name": "Incline Dumbbell Curl",
    "group": "arms"
  },
  {
    "id": "concentration-curl",
    "name": "Concentration Curl",
    "group": "arms"
  },
  {
    "id": "ez-bar-curl",
    "name": "EZ-Bar Curl",
    "group": "arms"
  },
  {
    "id": "spider-curl",
    "name": "Spider Curl",
    "group": "arms"
  },
  {
    "id": "tricep-pushdown",
    "name": "Tricep Pushdown",
    "group": "arms"
  },
  {
    "id": "skull-crusher",
    "name": "Skull Crusher",
    "group": "arms"
  },
  {
    "id": "overhead-tricep-extension",
    "name": "Overhead Tricep Extension",
    "group": "arms"
  },
  {
    "id": "close-grip-bench-press",
    "name": "Close-Grip Bench Press",
    "group": "arms"
  },
  {
    "id": "bench-dip",
    "name": "Bench Dip",
    "group": "arms"
  },
  {
    "id": "assisted-tricep-dip",
    "name": "Assisted Tricep Dip",
    "group": "arms"
  },
  {
    "id": "cable-overhead-tricep-extension",
    "name": "Cable Overhead Tricep Extension",
    "group": "arms"
  },
  {
    "id": "tricep-kickback",
    "name": "Tricep Kickback",
    "group": "arms"
  },
  {
    "id": "diamond-push-up",
    "name": "Diamond Push-up",
    "group": "arms"
  },
  {
    "id": "wrist-curl",
    "name": "Wrist Curl",
    "group": "arms"
  },
  {
    "id": "reverse-wrist-curl",
    "name": "Reverse Wrist Curl",
    "group": "arms"
  },
  {
    "id": "farmers-carry",
    "name": "Farmer's Carry",
    "group": "arms"
  },
  {
    "id": "plate-pinch-hold",
    "name": "Plate Pinch Hold",
    "group": "arms"
  },
  {
    "id": "reverse-curl",
    "name": "Reverse Curl",
    "group": "arms"
  },
  {
    "id": "dead-hang",
    "name": "Dead Hang",
    "group": "arms"
  },
  {
    "id": "crunch",
    "name": "Crunch",
    "group": "abs"
  },
  {
    "id": "cable-crunch",
    "name": "Cable Crunch",
    "group": "abs"
  },
  {
    "id": "hanging-leg-raise",
    "name": "Hanging Leg Raise",
    "group": "abs"
  },
  {
    "id": "sit-up",
    "name": "Sit-up",
    "group": "abs"
  },
  {
    "id": "decline-sit-up",
    "name": "Decline Sit-up",
    "group": "abs"
  },
  {
    "id": "ab-wheel-rollout",
    "name": "Ab Wheel Rollout",
    "group": "abs"
  },
  {
    "id": "plank",
    "name": "Plank",
    "group": "core"
  },
  {
    "id": "dead-bug",
    "name": "Dead Bug",
    "group": "core"
  },
  {
    "id": "bird-dog",
    "name": "Bird Dog",
    "group": "core"
  },
  {
    "id": "hollow-body-hold",
    "name": "Hollow Body Hold",
    "group": "core"
  },
  {
    "id": "mountain-climbers",
    "name": "Mountain Climbers",
    "group": "core"
  },
  {
    "id": "russian-twist",
    "name": "Russian Twist",
    "group": "abs"
  },
  {
    "id": "side-plank",
    "name": "Side Plank",
    "group": "abs"
  },
  {
    "id": "side-bend",
    "name": "Side Bend",
    "group": "abs"
  },
  {
    "id": "cable-woodchopper",
    "name": "Cable Woodchopper",
    "group": "abs"
  },
  {
    "id": "hanging-windshield-wipers",
    "name": "Hanging Windshield Wipers",
    "group": "abs"
  },
  {
    "id": "bicycle-crunch",
    "name": "Bicycle Crunch",
    "group": "abs"
  },
  {
    "id": "squat",
    "name": "Back Squat",
    "group": "quads"
  },
  {
    "id": "front-squat",
    "name": "Front Squat",
    "group": "quads"
  },
  {
    "id": "leg-press",
    "name": "Leg Press",
    "group": "quads"
  },
  {
    "id": "leg-extension",
    "name": "Leg Extension",
    "group": "quads"
  },
  {
    "id": "lunge",
    "name": "Lunge",
    "group": "quads"
  },
  {
    "id": "bulgarian-split-squat",
    "name": "Bulgarian Split Squat",
    "group": "quads"
  },
  {
    "id": "machine-hip-abduction",
    "name": "Machine Hip Abduction",
    "group": "glutes"
  },
  {
    "id": "cable-hip-abduction",
    "name": "Cable Hip Abduction",
    "group": "glutes"
  },
  {
    "id": "side-lying-hip-abduction",
    "name": "Side-Lying Hip Abduction",
    "group": "glutes"
  },
  {
    "id": "banded-hip-abduction",
    "name": "Banded Hip Abduction",
    "group": "glutes"
  },
  {
    "id": "lateral-band-walk",
    "name": "Lateral Band Walk",
    "group": "glutes"
  },
  {
    "id": "fire-hydrant",
    "name": "Fire Hydrant",
    "group": "glutes"
  },
  {
    "id": "machine-hip-adduction",
    "name": "Machine Hip Adduction",
    "group": "quads"
  },
  {
    "id": "cable-hip-adduction",
    "name": "Cable Hip Adduction",
    "group": "quads"
  },
  {
    "id": "sumo-squat",
    "name": "Sumo Squat",
    "group": "quads"
  },
  {
    "id": "side-lunge",
    "name": "Side Lunge",
    "group": "quads"
  },
  {
    "id": "copenhagen-plank",
    "name": "Copenhagen Plank",
    "group": "quads"
  },
  {
    "id": "banded-adductor-squeeze",
    "name": "Banded Adductor Squeeze",
    "group": "quads"
  },
  {
    "id": "romanian-deadlift",
    "name": "Romanian Deadlift",
    "group": "hamstrings"
  },
  {
    "id": "leg-curl",
    "name": "Leg Curl",
    "group": "hamstrings"
  },
  {
    "id": "good-morning",
    "name": "Good Morning",
    "group": "hamstrings"
  },
  {
    "id": "hip-thrust",
    "name": "Hip Thrust",
    "group": "glutes"
  },
  {
    "id": "glute-bridge",
    "name": "Glute Bridge",
    "group": "glutes"
  },
  {
    "id": "cable-kickback",
    "name": "Cable Kickback",
    "group": "glutes"
  },
  {
    "id": "standing-calf-raise",
    "name": "Standing Calf Raise",
    "group": "calves"
  },
  {
    "id": "seated-calf-raise",
    "name": "Seated Calf Raise",
    "group": "calves"
  }
]
