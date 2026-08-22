/*
 * Static strength-training exercise library. Each exercise's `muscles`
 * array lists the muscle groups it works, primary first — used both for
 * filtering the exercise picker and for the muscle diagram.
 */

export const MUSCLES = [
  'upper-chest', 'mid-chest', 'lower-chest',
  'front-delts', 'lateral-delts', 'rear-delts',
  'traps', 'lats', 'mid-back', 'lower-back',
  'biceps', 'triceps', 'forearms',
  'abs', 'core', 'side-abs',
  'quads', 'abductors', 'adductors', 'hamstrings', 'glutes', 'calves',
];

export const MUSCLE_LABEL = {
  'upper-chest': 'Upper Chest',
  'mid-chest': 'Mid Chest',
  'lower-chest': 'Lower Chest',
  'front-delts': 'Front Delts',
  'lateral-delts': 'Lateral Delts',
  'rear-delts': 'Rear Delts',
  traps: 'Traps',
  lats: 'Lats',
  'mid-back': 'Mid Back',
  'lower-back': 'Lower Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  core: 'Core',
  'side-abs': 'Side Abs',
  quads: 'Quads',
  abductors: 'Abductors',
  adductors: 'Adductors',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

/** Equipment options offered when logging or creating an exercise. */
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Band'];

/** Machine brands offered for Machine/Cable equipment - their resistance
 *  profiles differ enough to be worth recording per logged exercise. The
 *  "-" default isn't in this list; it's the dropdown's own placeholder
 *  option, same as other selects in the app. */
export const BRANDS = ['Hammer Strength', 'Life Fitness', 'Precor', 'Technogym', 'Ziva'];

// The muscle-balance radar chart reads MUSCLES' 22 groups as too granular
// to plot as a chart (see muscleSetBreakdown in workout.js) - it collapses
// them into these 9 general regions instead.
export const RADAR_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'quads', 'hamstrings', 'glutes', 'abs', 'core'];

export const RADAR_GROUP_LABEL = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  abs: 'Abs',
  core: 'Core',
};

/** Which radar group each of MUSCLES' finer-grained ids rolls up into. */
export const RADAR_GROUP_FOR = {
  'upper-chest': 'chest',
  'mid-chest': 'chest',
  'lower-chest': 'chest',
  'front-delts': 'shoulders',
  'lateral-delts': 'shoulders',
  'rear-delts': 'shoulders',
  traps: 'back',
  lats: 'back',
  'mid-back': 'back',
  'lower-back': 'back',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abs: 'abs',
  core: 'core',
  'side-abs': 'abs',
  quads: 'quads',
  abductors: 'glutes',
  adductors: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'quads',
};

export const EXERCISES = [
  // Upper chest
  { id: 'incline-bench-press', name: 'Incline Bench Press', equipment: 'Barbell', muscles: ['upper-chest', 'front-delts', 'triceps'] },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', equipment: 'Dumbbell', muscles: ['upper-chest', 'front-delts', 'triceps'] },
  { id: 'incline-dumbbell-fly', name: 'Incline Dumbbell Fly', equipment: 'Dumbbell', muscles: ['upper-chest'] },
  { id: 'low-to-high-cable-fly', name: 'Low-to-High Cable Fly', equipment: 'Cable', muscles: ['upper-chest'] },
  { id: 'incline-push-up', name: 'Incline Push-up', equipment: 'Bodyweight', muscles: ['upper-chest', 'triceps'] },
  { id: 'landmine-press', name: 'Landmine Press', equipment: 'Barbell', muscles: ['upper-chest', 'front-delts', 'triceps'] },

  // Mid chest
  { id: 'bench-press', name: 'Bench Press', equipment: 'Barbell', muscles: ['mid-chest', 'triceps', 'front-delts'] },
  { id: 'dumbbell-press', name: 'Dumbbell Bench Press', equipment: 'Dumbbell', muscles: ['mid-chest', 'triceps', 'front-delts'] },
  { id: 'push-up', name: 'Push-up', equipment: 'Bodyweight', muscles: ['mid-chest', 'triceps', 'front-delts'] },
  { id: 'chest-fly', name: 'Chest Fly', equipment: 'Dumbbell', muscles: ['mid-chest'] },
  { id: 'cable-crossover', name: 'Cable Crossover', equipment: 'Cable', muscles: ['mid-chest'] },
  { id: 'machine-chest-press', name: 'Machine Chest Press', equipment: 'Machine', muscles: ['mid-chest', 'triceps', 'front-delts'] },
  { id: 'pec-deck-fly', name: 'Pec Deck Fly', equipment: 'Machine', muscles: ['mid-chest'] },

  // Lower chest
  { id: 'dip', name: 'Dip', equipment: 'Bodyweight', muscles: ['lower-chest', 'triceps'] },
  { id: 'decline-bench-press', name: 'Decline Bench Press', equipment: 'Barbell', muscles: ['lower-chest', 'triceps'] },
  { id: 'decline-dumbbell-press', name: 'Decline Dumbbell Press', equipment: 'Dumbbell', muscles: ['lower-chest', 'triceps'] },
  { id: 'high-to-low-cable-fly', name: 'High-to-Low Cable Fly', equipment: 'Cable', muscles: ['lower-chest'] },
  { id: 'decline-push-up', name: 'Decline Push-up', equipment: 'Bodyweight', muscles: ['lower-chest', 'triceps'] },

  // Front delts
  { id: 'overhead-press', name: 'Overhead Press', equipment: 'Barbell', muscles: ['front-delts', 'triceps'] },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbell', muscles: ['front-delts', 'triceps'] },
  { id: 'arnold-press', name: 'Arnold Press', equipment: 'Dumbbell', muscles: ['front-delts', 'lateral-delts', 'triceps'] },
  { id: 'front-raise', name: 'Front Raise', equipment: 'Dumbbell', muscles: ['front-delts'] },
  { id: 'cable-front-raise', name: 'Cable Front Raise', equipment: 'Cable', muscles: ['front-delts'] },

  // Lateral delts
  { id: 'lateral-raise', name: 'Lateral Raise', equipment: 'Dumbbell', muscles: ['lateral-delts'] },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', equipment: 'Cable', muscles: ['lateral-delts'] },
  { id: 'machine-lateral-raise', name: 'Machine Lateral Raise', equipment: 'Machine', muscles: ['lateral-delts'] },
  { id: 'cable-y-raise', name: 'Cable Y-Raise', equipment: 'Cable', muscles: ['lateral-delts', 'rear-delts'] },

  // Rear delts
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', equipment: 'Dumbbell', muscles: ['rear-delts', 'mid-back'] },
  { id: 'face-pull', name: 'Face Pull', equipment: 'Cable', muscles: ['rear-delts', 'mid-back'] },
  { id: 'reverse-pec-deck', name: 'Reverse Pec Deck', equipment: 'Machine', muscles: ['rear-delts'] },
  { id: 'cable-rear-delt-fly', name: 'Cable Rear Delt Fly', equipment: 'Cable', muscles: ['rear-delts'] },
  { id: 'bent-over-rear-delt-raise', name: 'Bent-Over Rear Delt Raise', equipment: 'Dumbbell', muscles: ['rear-delts'] },

  // Traps
  { id: 'barbell-shrug', name: 'Barbell Shrug', equipment: 'Barbell', muscles: ['traps'] },
  { id: 'dumbbell-shrug', name: 'Dumbbell Shrug', equipment: 'Dumbbell', muscles: ['traps'] },
  { id: 'upright-row', name: 'Upright Row', equipment: 'Barbell', muscles: ['traps', 'lateral-delts'] },
  { id: 'snatch-grip-high-pull', name: 'Snatch-Grip High Pull', equipment: 'Barbell', muscles: ['traps'] },

  // Lats
  { id: 'pull-up', name: 'Pull-up', equipment: 'Bodyweight', muscles: ['lats', 'biceps'] },
  { id: 'chin-up', name: 'Chin-up', equipment: 'Bodyweight', muscles: ['lats', 'biceps'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', equipment: 'Cable', muscles: ['lats', 'biceps'] },
  { id: 'wide-grip-lat-pulldown', name: 'Wide-Grip Lat Pulldown', equipment: 'Cable', muscles: ['lats', 'biceps'] },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', equipment: 'Cable', muscles: ['lats'] },
  { id: 'v-bar-pulldown', name: 'V-Bar Lat Pulldown', equipment: 'Cable', muscles: ['lats', 'biceps'] },

  // Mid back
  { id: 'barbell-row', name: 'Barbell Row', equipment: 'Barbell', muscles: ['mid-back', 'lats', 'biceps'] },
  { id: 'seated-cable-row', name: 'Seated Cable Row', equipment: 'Cable', muscles: ['mid-back', 'lats', 'biceps'] },
  { id: 'dumbbell-row', name: 'One-Arm Dumbbell Row', equipment: 'Dumbbell', muscles: ['mid-back', 'lats', 'biceps'] },
  { id: 't-bar-row', name: 'T-Bar Row', equipment: 'Barbell', muscles: ['mid-back', 'lats', 'biceps'] },
  { id: 'chest-supported-row', name: 'Chest-Supported Row', equipment: 'Dumbbell', muscles: ['mid-back', 'lats'] },
  { id: 'machine-row', name: 'Machine Row', equipment: 'Machine', muscles: ['mid-back', 'lats'] },

  // Lower back
  { id: 'deadlift', name: 'Deadlift', equipment: 'Barbell', muscles: ['lower-back', 'glutes', 'hamstrings'] },
  { id: 'back-extension', name: 'Back Extension', equipment: 'Bodyweight', muscles: ['lower-back', 'glutes'] },
  { id: 'superman', name: 'Superman', equipment: 'Bodyweight', muscles: ['lower-back'] },

  // Biceps
  { id: 'barbell-curl', name: 'Barbell Curl', equipment: 'Barbell', muscles: ['biceps'] },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', equipment: 'Dumbbell', muscles: ['biceps'] },
  { id: 'hammer-curl', name: 'Hammer Curl', equipment: 'Dumbbell', muscles: ['biceps', 'forearms'] },
  { id: 'preacher-curl', name: 'Preacher Curl', equipment: 'Barbell', muscles: ['biceps'] },
  { id: 'cable-curl', name: 'Cable Curl', equipment: 'Cable', muscles: ['biceps'] },
  { id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', equipment: 'Dumbbell', muscles: ['biceps'] },
  { id: 'concentration-curl', name: 'Concentration Curl', equipment: 'Dumbbell', muscles: ['biceps'] },
  { id: 'ez-bar-curl', name: 'EZ-Bar Curl', equipment: 'Barbell', muscles: ['biceps'] },
  { id: 'spider-curl', name: 'Spider Curl', equipment: 'Barbell', muscles: ['biceps'] },

  // Triceps
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', equipment: 'Cable', muscles: ['triceps'] },
  { id: 'skull-crusher', name: 'Skull Crusher', equipment: 'Barbell', muscles: ['triceps'] },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', equipment: 'Dumbbell', muscles: ['triceps'] },
  { id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', equipment: 'Barbell', muscles: ['triceps', 'mid-chest'] },
  { id: 'bench-dip', name: 'Bench Dip', equipment: 'Bodyweight', muscles: ['triceps'] },
  { id: 'cable-overhead-tricep-extension', name: 'Cable Overhead Tricep Extension', equipment: 'Cable', muscles: ['triceps'] },
  { id: 'tricep-kickback', name: 'Tricep Kickback', equipment: 'Dumbbell', muscles: ['triceps'] },
  { id: 'diamond-push-up', name: 'Diamond Push-up', equipment: 'Bodyweight', muscles: ['triceps', 'mid-chest'] },

  // Forearms
  { id: 'wrist-curl', name: 'Wrist Curl', equipment: 'Dumbbell', muscles: ['forearms'] },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', equipment: 'Dumbbell', muscles: ['forearms'] },
  { id: 'farmers-carry', name: "Farmer's Carry", equipment: 'Dumbbell', muscles: ['forearms', 'traps'] },
  { id: 'plate-pinch-hold', name: 'Plate Pinch Hold', equipment: 'Dumbbell', muscles: ['forearms'] },
  { id: 'reverse-curl', name: 'Reverse Curl', equipment: 'Barbell', muscles: ['forearms', 'biceps'] },
  { id: 'dead-hang', name: 'Dead Hang', equipment: 'Bodyweight', muscles: ['forearms'] },

  // Abs
  { id: 'crunch', name: 'Crunch', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'cable-crunch', name: 'Cable Crunch', equipment: 'Cable', muscles: ['abs'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'sit-up', name: 'Sit-up', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'decline-sit-up', name: 'Decline Sit-up', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', equipment: 'Bodyweight', muscles: ['abs', 'core'] },

  // Core
  { id: 'plank', name: 'Plank', equipment: 'Bodyweight', muscles: ['core'] },
  { id: 'dead-bug', name: 'Dead Bug', equipment: 'Bodyweight', muscles: ['core'] },
  { id: 'bird-dog', name: 'Bird Dog', equipment: 'Bodyweight', muscles: ['core'] },
  { id: 'hollow-body-hold', name: 'Hollow Body Hold', equipment: 'Bodyweight', muscles: ['core'] },
  { id: 'mountain-climbers', name: 'Mountain Climbers', equipment: 'Bodyweight', muscles: ['core', 'abs'] },

  // Side abs
  { id: 'russian-twist', name: 'Russian Twist', equipment: 'Bodyweight', muscles: ['side-abs'] },
  { id: 'side-plank', name: 'Side Plank', equipment: 'Bodyweight', muscles: ['side-abs', 'core'] },
  { id: 'side-bend', name: 'Side Bend', equipment: 'Dumbbell', muscles: ['side-abs'] },
  { id: 'cable-woodchopper', name: 'Cable Woodchopper', equipment: 'Cable', muscles: ['side-abs'] },
  { id: 'hanging-windshield-wipers', name: 'Hanging Windshield Wipers', equipment: 'Bodyweight', muscles: ['side-abs'] },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', equipment: 'Bodyweight', muscles: ['side-abs', 'abs'] },

  // Quads
  { id: 'squat', name: 'Back Squat', equipment: 'Barbell', muscles: ['quads', 'glutes'] },
  { id: 'front-squat', name: 'Front Squat', equipment: 'Barbell', muscles: ['quads', 'glutes'] },
  { id: 'leg-press', name: 'Leg Press', equipment: 'Machine', muscles: ['quads', 'glutes'] },
  { id: 'leg-extension', name: 'Leg Extension', equipment: 'Machine', muscles: ['quads'] },
  { id: 'lunge', name: 'Lunge', equipment: 'Dumbbell', muscles: ['quads', 'glutes'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', equipment: 'Dumbbell', muscles: ['quads', 'glutes'] },

  // Abductors
  { id: 'machine-hip-abduction', name: 'Machine Hip Abduction', equipment: 'Machine', muscles: ['abductors'] },
  { id: 'cable-hip-abduction', name: 'Cable Hip Abduction', equipment: 'Cable', muscles: ['abductors'] },
  { id: 'side-lying-hip-abduction', name: 'Side-Lying Hip Abduction', equipment: 'Bodyweight', muscles: ['abductors'] },
  { id: 'banded-hip-abduction', name: 'Banded Hip Abduction', equipment: 'Band', muscles: ['abductors'] },
  { id: 'lateral-band-walk', name: 'Lateral Band Walk', equipment: 'Band', muscles: ['abductors', 'glutes'] },
  { id: 'fire-hydrant', name: 'Fire Hydrant', equipment: 'Bodyweight', muscles: ['abductors', 'glutes'] },

  // Adductors
  { id: 'machine-hip-adduction', name: 'Machine Hip Adduction', equipment: 'Machine', muscles: ['adductors'] },
  { id: 'cable-hip-adduction', name: 'Cable Hip Adduction', equipment: 'Cable', muscles: ['adductors'] },
  { id: 'sumo-squat', name: 'Sumo Squat', equipment: 'Barbell', muscles: ['adductors', 'quads', 'glutes'] },
  { id: 'side-lunge', name: 'Side Lunge', equipment: 'Dumbbell', muscles: ['adductors', 'quads', 'glutes'] },
  { id: 'copenhagen-plank', name: 'Copenhagen Plank', equipment: 'Bodyweight', muscles: ['adductors', 'core'] },
  { id: 'banded-adductor-squeeze', name: 'Banded Adductor Squeeze', equipment: 'Band', muscles: ['adductors'] },

  // Hamstrings
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', equipment: 'Barbell', muscles: ['hamstrings', 'glutes'] },
  { id: 'leg-curl', name: 'Leg Curl', equipment: 'Machine', muscles: ['hamstrings'] },
  { id: 'good-morning', name: 'Good Morning', equipment: 'Barbell', muscles: ['hamstrings', 'lower-back'] },

  // Glutes
  { id: 'hip-thrust', name: 'Hip Thrust', equipment: 'Barbell', muscles: ['glutes', 'hamstrings'] },
  { id: 'glute-bridge', name: 'Glute Bridge', equipment: 'Bodyweight', muscles: ['glutes'] },
  { id: 'cable-kickback', name: 'Cable Kickback', equipment: 'Cable', muscles: ['glutes'] },

  // Calves
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', equipment: 'Machine', muscles: ['calves'] },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', equipment: 'Machine', muscles: ['calves'] },
];

/** @param {typeof EXERCISES} [list] defaults to the built-in library; pass a
 *   list that also includes the user's custom exercises to search those too. */
export function exerciseById(id, list = EXERCISES) {
  return list.find((e) => e.id === id) ?? null;
}

/** Case-insensitive name search, optionally narrowed to one muscle group.
 * @param {typeof EXERCISES} [list] defaults to the built-in library; pass a
 *   list that also includes the user's custom exercises to search those too. */
export function searchExercises(query, muscle, list = EXERCISES) {
  const q = (query || '').trim().toLowerCase();
  return list.filter((e) => {
    if (muscle && !e.muscles.includes(muscle)) return false;
    return !q || e.name.toLowerCase().includes(q);
  });
}
