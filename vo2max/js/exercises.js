/*
 * Static strength-training exercise library. Each exercise's `muscles`
 * array lists the muscle groups it works, primary first — used both for
 * filtering the exercise picker and for the muscle diagram.
 */

export const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves',
];

export const MUSCLE_LABEL = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export const EXERCISES = [
  // Chest
  { id: 'bench-press', name: 'Bench Press', equipment: 'Barbell', muscles: ['chest', 'triceps', 'shoulders'] },
  { id: 'incline-bench-press', name: 'Incline Bench Press', equipment: 'Barbell', muscles: ['chest', 'shoulders', 'triceps'] },
  { id: 'dumbbell-press', name: 'Dumbbell Bench Press', equipment: 'Dumbbell', muscles: ['chest', 'triceps', 'shoulders'] },
  { id: 'push-up', name: 'Push-up', equipment: 'Bodyweight', muscles: ['chest', 'triceps', 'shoulders'] },
  { id: 'chest-fly', name: 'Chest Fly', equipment: 'Dumbbell', muscles: ['chest'] },
  { id: 'cable-crossover', name: 'Cable Crossover', equipment: 'Cable', muscles: ['chest'] },
  { id: 'dip', name: 'Dip', equipment: 'Bodyweight', muscles: ['chest', 'triceps'] },

  // Back
  { id: 'deadlift', name: 'Deadlift', equipment: 'Barbell', muscles: ['back', 'glutes', 'hamstrings'] },
  { id: 'pull-up', name: 'Pull-up', equipment: 'Bodyweight', muscles: ['back', 'biceps'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', equipment: 'Cable', muscles: ['back', 'biceps'] },
  { id: 'barbell-row', name: 'Barbell Row', equipment: 'Barbell', muscles: ['back', 'biceps'] },
  { id: 'seated-cable-row', name: 'Seated Cable Row', equipment: 'Cable', muscles: ['back', 'biceps'] },
  { id: 'dumbbell-row', name: 'One-Arm Dumbbell Row', equipment: 'Dumbbell', muscles: ['back', 'biceps'] },
  { id: 't-bar-row', name: 'T-Bar Row', equipment: 'Barbell', muscles: ['back', 'biceps'] },

  // Shoulders
  { id: 'overhead-press', name: 'Overhead Press', equipment: 'Barbell', muscles: ['shoulders', 'triceps'] },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbell', muscles: ['shoulders', 'triceps'] },
  { id: 'lateral-raise', name: 'Lateral Raise', equipment: 'Dumbbell', muscles: ['shoulders'] },
  { id: 'front-raise', name: 'Front Raise', equipment: 'Dumbbell', muscles: ['shoulders'] },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', equipment: 'Dumbbell', muscles: ['shoulders', 'back'] },
  { id: 'face-pull', name: 'Face Pull', equipment: 'Cable', muscles: ['shoulders', 'back'] },
  { id: 'arnold-press', name: 'Arnold Press', equipment: 'Dumbbell', muscles: ['shoulders', 'triceps'] },

  // Biceps
  { id: 'barbell-curl', name: 'Barbell Curl', equipment: 'Barbell', muscles: ['biceps'] },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', equipment: 'Dumbbell', muscles: ['biceps'] },
  { id: 'hammer-curl', name: 'Hammer Curl', equipment: 'Dumbbell', muscles: ['biceps', 'forearms'] },
  { id: 'preacher-curl', name: 'Preacher Curl', equipment: 'Barbell', muscles: ['biceps'] },
  { id: 'cable-curl', name: 'Cable Curl', equipment: 'Cable', muscles: ['biceps'] },

  // Triceps
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', equipment: 'Cable', muscles: ['triceps'] },
  { id: 'skull-crusher', name: 'Skull Crusher', equipment: 'Barbell', muscles: ['triceps'] },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', equipment: 'Dumbbell', muscles: ['triceps'] },
  { id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', equipment: 'Barbell', muscles: ['triceps', 'chest'] },

  // Forearms
  { id: 'wrist-curl', name: 'Wrist Curl', equipment: 'Dumbbell', muscles: ['forearms'] },
  { id: 'farmers-carry', name: "Farmer's Carry", equipment: 'Dumbbell', muscles: ['forearms', 'back'] },

  // Abs
  { id: 'crunch', name: 'Crunch', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'plank', name: 'Plank', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', equipment: 'Bodyweight', muscles: ['abs'] },
  { id: 'cable-crunch', name: 'Cable Crunch', equipment: 'Cable', muscles: ['abs'] },
  { id: 'russian-twist', name: 'Russian Twist', equipment: 'Bodyweight', muscles: ['abs'] },

  // Quads
  { id: 'squat', name: 'Back Squat', equipment: 'Barbell', muscles: ['quads', 'glutes'] },
  { id: 'front-squat', name: 'Front Squat', equipment: 'Barbell', muscles: ['quads', 'glutes'] },
  { id: 'leg-press', name: 'Leg Press', equipment: 'Machine', muscles: ['quads', 'glutes'] },
  { id: 'leg-extension', name: 'Leg Extension', equipment: 'Machine', muscles: ['quads'] },
  { id: 'lunge', name: 'Lunge', equipment: 'Dumbbell', muscles: ['quads', 'glutes'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', equipment: 'Dumbbell', muscles: ['quads', 'glutes'] },

  // Hamstrings
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', equipment: 'Barbell', muscles: ['hamstrings', 'glutes'] },
  { id: 'leg-curl', name: 'Leg Curl', equipment: 'Machine', muscles: ['hamstrings'] },
  { id: 'good-morning', name: 'Good Morning', equipment: 'Barbell', muscles: ['hamstrings', 'back'] },

  // Glutes
  { id: 'hip-thrust', name: 'Hip Thrust', equipment: 'Barbell', muscles: ['glutes', 'hamstrings'] },
  { id: 'glute-bridge', name: 'Glute Bridge', equipment: 'Bodyweight', muscles: ['glutes'] },
  { id: 'cable-kickback', name: 'Cable Kickback', equipment: 'Cable', muscles: ['glutes'] },

  // Calves
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', equipment: 'Machine', muscles: ['calves'] },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', equipment: 'Machine', muscles: ['calves'] },
];

export function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

/** Case-insensitive name search, optionally narrowed to one muscle group. */
export function searchExercises(query, muscle) {
  const q = (query || '').trim().toLowerCase();
  return EXERCISES.filter((e) => {
    if (muscle && !e.muscles.includes(muscle)) return false;
    return !q || e.name.toLowerCase().includes(q);
  });
}
