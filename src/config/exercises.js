// Exercise definitions with validation rules and form checks
// Science-based form criteria from biomechanics research and sports science literature

export const EXERCISES = {
  SQUAT: {
    id: 'squat',
    name: 'Barbell Squat',
    category: 'lower_body',
    icon: '🏋️',
    description: 'Compound lower body exercise targeting quads, glutes, and core',
    musclesTargeted: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core', 'Spinal Erectors'],
    commonMistakes: [
      'Knees caving inward (valgus)',
      'Not reaching proper depth',
      'Excessive forward lean',
      'Heels lifting off ground',
      'Looking down instead of forward',
      'Butt wink (posterior pelvic tilt)',
      'Weight shifting to toes',
      'Asymmetrical stance or descent'
    ],
    formTips: [
      'Feet shoulder-width apart, toes slightly out (15-30°)',
      'Knees track over 2nd-3rd toes throughout movement',
      'Keep chest up and maintain neutral spine',
      'Descend until hip crease below knee (parallel+)',
      'Drive through midfoot/heels on ascent',
      'Brace core with deep breath before descent',
      'Keep bar over midfoot throughout lift'
    ],
    landmarks: {
      leftShoulder: 11,
      rightShoulder: 12,
      leftHip: 23,
      rightHip: 24,
      leftKnee: 25,
      rightKnee: 26,
      leftAnkle: 27,
      rightAnkle: 28
    },
    validationChecks: [
      {
        id: 'knee_valgus',
        name: 'Knee Valgus',
        severity: 'high',
        description: 'Knees caving inward - increases ACL/MCL injury risk',
        correction: 'Push knees outward over toes. Cue: "Spread the floor" with feet. Strengthen glute medius.',
        affectedJoints: [25, 26], // left and right knee
        validate: (landmarks) => {
          const kneeWidth = Math.abs(landmarks.leftKnee.x - landmarks.rightKnee.x);
          const ankleWidth = Math.abs(landmarks.leftAnkle.x - landmarks.rightAnkle.x);
          return kneeWidth < ankleWidth * 0.85;
        }
      },
      {
        id: 'shallow_depth',
        name: 'Insufficient Depth',
        severity: 'medium',
        description: 'Not squatting deep enough - reduces muscle activation',
        correction: 'Lower until hip crease is below knee level (parallel or below). Full depth maximizes glute/hamstring recruitment.',
        affectedJoints: [23, 24, 25, 26], // hips and knees
        validate: (landmarks, angles) => {
          return angles.kneeAngle > 100;
        }
      },
      {
        id: 'excessive_lean',
        name: 'Excessive Forward Lean',
        severity: 'medium',
        description: 'Leaning too far forward - shifts stress to lower back',
        correction: 'Keep chest up, core tight. May indicate weak quads or limited ankle mobility. Try heel wedges or squat shoes.',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips
        validate: (landmarks, angles) => {
          return angles.hipAngle < 70;
        }
      },
      {
        id: 'heel_lift',
        name: 'Heel Elevation',
        severity: 'high',
        description: 'Heels lifting off ground - compromises balance and power',
        correction: 'Keep weight on whole foot. Work on ankle dorsiflexion mobility. Consider squat shoes with elevated heel.',
        affectedJoints: [27, 28], // ankles
        validate: (landmarks) => {
          const ankleY = (landmarks.leftAnkle.y + landmarks.rightAnkle.y) / 2;
          const kneeY = (landmarks.leftKnee.y + landmarks.rightKnee.y) / 2;
          return ankleY < kneeY - 0.15;
        }
      },
      {
        id: 'knee_forward_travel',
        name: 'Excessive Knee Forward Travel',
        severity: 'low',
        description: 'Knees traveling excessively past toes',
        correction: 'Some forward travel is normal, but excessive indicates weight on toes. Sit back more into hips.',
        affectedJoints: [25, 26, 27, 28], // knees and ankles
        validate: (landmarks) => {
          const kneeX = (landmarks.leftKnee.x + landmarks.rightKnee.x) / 2;
          const ankleX = (landmarks.leftAnkle.x + landmarks.rightAnkle.x) / 2;
          return Math.abs(kneeX - ankleX) > 0.15;
        }
      },
      {
        id: 'asymmetric_descent',
        name: 'Asymmetric Squat Pattern',
        severity: 'medium',
        description: 'Uneven weight distribution or hip shift',
        correction: 'Address mobility/strength imbalances. May indicate hip or ankle tightness on one side.',
        affectedJoints: [23, 24, 25, 26], // hips and knees
        validate: (landmarks) => {
          const leftKneeY = landmarks.leftKnee.y;
          const rightKneeY = landmarks.rightKnee.y;
          return Math.abs(leftKneeY - rightKneeY) > 0.08;
        }
      },
      {
        id: 'back_rounding_squat',
        name: 'Excessive Back Rounding',
        severity: 'critical',
        description: 'Thoracic/lumbar spine flexing excessively - HIGH INJURY RISK',
        correction: 'Keep chest up, engage lats. "Proud chest" cue. May indicate weak spinal erectors or poor mobility. Lower weight if needed.',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips (representing spine)
        validate: (landmarks, angles) => {
          if (!angles.backRounding) return false;
          return angles.backRounding.isRounded;
        }
      },
      {
        id: 'hips_too_far_back',
        name: 'Hips Too Far Back',
        severity: 'medium',
        description: 'Hips shifting excessively behind knees - creates inefficient squat pattern',
        correction: 'Keep hips more centered over midfoot. May need to work on ankle mobility or try squat shoes to allow more upright torso.',
        affectedJoints: [23, 24, 25, 26], // hips and knees
        validate: (landmarks, angles) => {
          if (!angles.hipPosition) return false;
          return angles.hipPosition.hipsTooFarBack;
        }
      }
    ]
  },

  DEADLIFT: {
    id: 'deadlift',
    name: 'Deadlift',
    category: 'lower_body',
    icon: '💪',
    description: 'Full body compound exercise emphasizing posterior chain',
    musclesTargeted: ['Hamstrings', 'Glutes', 'Lower Back', 'Lats', 'Traps', 'Grip'],
    commonMistakes: [
      'Rounded back (lumbar/thoracic flexion)',
      'Hips starting too low (squatting the weight)',
      'Bar drifting away from body',
      'Not engaging lats',
      'Hyperextending at lockout',
      'Looking up excessively',
      'Pulling with arms bent',
      'Hips rising faster than shoulders'
    ],
    formTips: [
      'Neutral spine throughout - no rounding',
      'Bar stays close to shins and thighs',
      'Hip hinge pattern - not a squat',
      'Engage lats - "bend the bar" or "protect armpits"',
      'Full lockout: squeeze glutes, dont hyperextend',
      'Keep chin tucked, neutral neck',
      'Arms are hooks - pull with hips/legs'
    ],
    landmarks: {
      leftShoulder: 11,
      rightShoulder: 12,
      leftHip: 23,
      rightHip: 24,
      leftKnee: 25,
      rightKnee: 26,
      leftAnkle: 27,
      rightAnkle: 28
    },
    validationChecks: [
      {
        id: 'rounded_back',
        name: 'Spinal Flexion',
        severity: 'critical',
        description: 'Back rounding detected - HIGH INJURY RISK to spinal discs',
        correction: 'Maintain neutral spine at ALL times. Engage lats, chest up. Lower weight immediately if you cannot maintain position.',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips
        validate: (landmarks, angles) => {
          return angles.backAngle < 150;
        }
      },
      {
        id: 'mid_back_rounding',
        name: 'Mid-Back Rounding',
        severity: 'critical',
        description: 'Thoracic spine rounding detected - indicates loss of lat engagement and spinal stability',
        correction: '"Bend the bar" cue to engage lats. Keep chest proud, shoulders back. May need to reduce weight.',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips (representing spine)
        validate: (landmarks, angles) => {
          if (!angles.backRounding) return false;
          return angles.backRounding.isRounded;
        }
      },
      {
        id: 'hips_too_low',
        name: 'Low Hip Position',
        severity: 'medium',
        description: 'Hips starting too low - turning deadlift into a squat',
        correction: 'Raise hips until shoulders are slightly in front of bar. This is a hip hinge movement.',
        affectedJoints: [23, 24], // hips
        validate: (landmarks) => {
          const shoulderHipDist = Math.abs(landmarks.leftShoulder.y - landmarks.leftHip.y);
          const hipKneeDist = Math.abs(landmarks.leftHip.y - landmarks.leftKnee.y);
          return shoulderHipDist < hipKneeDist * 0.7;
        }
      },
      {
        id: 'hips_rising_first',
        name: 'Hips Rising First',
        severity: 'high',
        description: 'Hips shooting up faster than shoulders - stiff-leg deadlift pattern',
        correction: 'Push through floor while maintaining hip-shoulder angle. Cue: "Leg press the floor away".',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips
        validate: (landmarks, angles) => {
          // Check if hip angle is opening much faster than shoulder position is rising
          return angles.backAngle < 140 && landmarks.leftHip.y < landmarks.leftShoulder.y;
        }
      },
      {
        id: 'hyperextension',
        name: 'Lumbar Hyperextension',
        severity: 'medium',
        description: 'Over-arching at lockout - compresses lumbar spine',
        correction: 'Finish by squeezing glutes and standing tall. Dont lean back or push hips forward excessively.',
        affectedJoints: [23, 24], // hips
        validate: (landmarks, angles) => {
          // At lockout, back angle should be nearly 180, not arched past it
          return angles.backAngle > 185;
        }
      },
      {
        id: 'shoulders_behind_bar',
        name: 'Shoulders Behind Bar',
        severity: 'medium',
        description: 'Starting with shoulders behind the bar',
        correction: 'Shoulders should be slightly in front of or directly over the bar at start. This optimizes leverage.',
        affectedJoints: [11, 12], // shoulders
        validate: (landmarks) => {
          const shoulderX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
          const hipX = (landmarks.leftHip.x + landmarks.rightHip.x) / 2;
          // In side view, shoulders significantly behind hips indicates too far back
          return shoulderX > hipX + 0.1;
        }
      }
    ]
  },

  OVERHEAD_PRESS: {
    id: 'overhead_press',
    name: 'Overhead Press',
    category: 'upper_body',
    icon: '🎯',
    description: 'Shoulder and tricep builder with core stabilization',
    musclesTargeted: ['Anterior Deltoids', 'Lateral Deltoids', 'Triceps', 'Upper Chest', 'Core', 'Serratus Anterior'],
    commonMistakes: [
      'Excessive back arching',
      'Not locking out fully',
      'Bar path not vertical',
      'Elbows flaring out',
      'Using leg drive (push press)',
      'Pressing in front of face',
      'Head not moving back',
      'No scapular upward rotation'
    ],
    formTips: [
      'Core engaged, squeeze glutes, ribs down',
      'Press bar in straight vertical line',
      'Full lockout with scapular elevation at top',
      'Elbows slightly forward at start (45°)',
      'Move head back to let bar pass, then forward',
      'Strict press - no leg drive or hip thrust',
      'Grip just outside shoulder width'
    ],
    landmarks: {
      leftShoulder: 11,
      rightShoulder: 12,
      leftElbow: 13,
      rightElbow: 14,
      leftWrist: 15,
      rightWrist: 16,
      leftHip: 23,
      rightHip: 24
    },
    validationChecks: [
      {
        id: 'back_arch',
        name: 'Excessive Lumbar Extension',
        severity: 'high',
        description: 'Excessive back arching - compresses lumbar spine under load',
        correction: 'Squeeze glutes hard, tuck hips under, keep ribs down. If arching persists, lower the weight.',
        affectedJoints: [23, 24], // hips
        validate: (landmarks, angles) => {
          return angles.bodyAngle < 165;
        }
      },
      {
        id: 'mid_back_rounding_press',
        name: 'Thoracic Rounding',
        severity: 'medium',
        description: 'Upper back rounding during press - reduces pressing power and stability',
        correction: 'Keep chest proud, squeeze shoulder blades together. Think "tall spine" throughout movement.',
        affectedJoints: [11, 12, 23, 24], // shoulders and hips
        validate: (landmarks, angles) => {
          if (!angles.backRounding) return false;
          return angles.backRounding.isRounded;
        }
      },
      {
        id: 'incomplete_lockout',
        name: 'Incomplete Lockout',
        severity: 'medium',
        description: 'Not fully locking out overhead - reduces ROM and tricep activation',
        correction: 'Press until arms are fully extended and ears are in front of arms. Shrug slightly at top.',
        affectedJoints: [13, 14, 15, 16], // elbows and wrists
        validate: (landmarks, angles) => {
          return angles.elbowAngle < 165;
        }
      },
      {
        id: 'elbow_flare_press',
        name: 'Elbow Flare',
        severity: 'medium',
        description: 'Elbows flaring out at start - reduces power and stresses shoulder',
        correction: 'Start with elbows at 45° in front of body, pointing slightly forward. Stack wrists over elbows.',
        affectedJoints: [13, 14], // elbows
        validate: (landmarks) => {
          const elbowWidth = Math.abs(landmarks.leftElbow.x - landmarks.rightElbow.x);
          const shoulderWidth = Math.abs(landmarks.leftShoulder.x - landmarks.rightShoulder.x);
          return elbowWidth > shoulderWidth * 1.3;
        }
      },
      {
        id: 'forward_press_path',
        name: 'Forward Press Path',
        severity: 'medium',
        description: 'Pressing the bar forward instead of straight up',
        correction: 'Move head back at start, press straight up, then move head forward under bar.',
        affectedJoints: [15, 16], // wrists
        validate: (landmarks) => {
          const wristX = (landmarks.leftWrist.x + landmarks.rightWrist.x) / 2;
          const shoulderX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
          return wristX > shoulderX + 0.12;
        }
      },
      {
        id: 'using_leg_drive',
        name: 'Using Leg Drive',
        severity: 'low',
        description: 'Using legs to initiate the press (turning into push press)',
        correction: 'Keep legs completely locked and still. If you need leg drive, the weight may be too heavy.',
        affectedJoints: [25, 26], // knees
        validate: (landmarks) => {
          // Check if knees are bending during press
          const kneeY = (landmarks.leftKnee?.y + landmarks.rightKnee?.y) / 2;
          const hipY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
          return kneeY && Math.abs(kneeY - hipY) > 0.2;
        }
      }
    ]
  },

  BENCH_PRESS: {
    id: 'bench_press',
    name: 'Bench Press',
    category: 'upper_body',
    icon: '🏋️‍♀️',
    description: 'Upper body pressing movement for chest, shoulders, and triceps',
    musclesTargeted: ['Pectoralis Major', 'Anterior Deltoids', 'Triceps', 'Serratus Anterior'],
    commonMistakes: [
      'Elbows flared too wide (90°)',
      'No leg drive / feet floating',
      'Bouncing bar off chest',
      'Inconsistent bar path',
      'Shoulders not retracted',
      'Flat back (no arch)',
      'Wrists bent back',
      'Uneven bar path'
    ],
    formTips: [
      'Retract AND depress shoulder blades',
      'Elbows at ~45-75° angle from torso',
      'Slight arch in UPPER back, not lower',
      'Drive feet into ground for stability',
      'Touch mid-sternum, pause, press',
      'Bar path: slight diagonal from chest to lockout',
      'Wrists straight, bar over forearm'
    ],
    landmarks: {
      leftShoulder: 11,
      rightShoulder: 12,
      leftElbow: 13,
      rightElbow: 14,
      leftWrist: 15,
      rightWrist: 16
    },
    validationChecks: [
      {
        id: 'elbow_flare',
        name: 'Excessive Elbow Flare',
        severity: 'high',
        description: 'Elbows flared too wide (90°) - high shoulder injury risk',
        correction: 'Keep elbows at 45-75° from torso. Protects shoulder joint and improves power transfer.',
        affectedJoints: [13, 14], // elbows
        validate: (landmarks, angles) => {
          // Check elbow position relative to shoulders
          const elbowWidth = Math.abs(landmarks.leftElbow.x - landmarks.rightElbow.x);
          const shoulderWidth = Math.abs(landmarks.leftShoulder.x - landmarks.rightShoulder.x);
          return elbowWidth > shoulderWidth * 1.4;
        }
      },
      {
        id: 'bar_bounce',
        name: 'No Pause at Bottom',
        severity: 'medium',
        description: 'Bouncing bar off chest - reduces muscle tension and risks sternum injury',
        correction: 'Touch chest lightly, pause briefly (1 second), then press. Control the weight.',
        affectedJoints: [15, 16], // wrists (bar position)
        validate: (landmarks, angles) => {
          // Hard to detect from landmarks alone - checking elbow depth
          return angles.elbowAngle < 60;
        }
      },
      {
        id: 'uneven_press',
        name: 'Uneven Bar Path',
        severity: 'medium',
        description: 'One arm extending faster than the other',
        correction: 'Focus on pressing evenly. May indicate strength imbalance - add unilateral work.',
        affectedJoints: [13, 14, 15, 16], // both elbows and wrists
        validate: (landmarks) => {
          const leftElbowY = landmarks.leftElbow.y;
          const rightElbowY = landmarks.rightElbow.y;
          return Math.abs(leftElbowY - rightElbowY) > 0.08;
        }
      },
      {
        id: 'wrist_extension',
        name: 'Wrist Bent Back',
        severity: 'medium',
        description: 'Wrists bent backward - strains wrist joint',
        correction: 'Keep wrists straight and stacked over forearms. Bar should sit in heel of palm.',
        affectedJoints: [15, 16], // wrists
        validate: (landmarks) => {
          // Check if wrists are behind elbows in horizontal plane
          const wristX = (landmarks.leftWrist.x + landmarks.rightWrist.x) / 2;
          const elbowX = (landmarks.leftElbow.x + landmarks.rightElbow.x) / 2;
          return Math.abs(wristX - elbowX) > 0.1;
        }
      },
      {
        id: 'incomplete_lockout_bench',
        name: 'Incomplete Lockout',
        severity: 'low',
        description: 'Not fully extending arms at top',
        correction: 'Lock out elbows at top of each rep for full tricep activation. Dont hyperextend.',
        affectedJoints: [13, 14], // elbows
        validate: (landmarks, angles) => {
          return angles.elbowAngle < 160 && angles.elbowAngle > 120;
        }
      }
    ]
  },

  PULL_UP: {
    id: 'pull_up',
    name: 'Pull-Up',
    category: 'upper_body',
    icon: '💪',
    description: 'Vertical pulling exercise for back and biceps',
    musclesTargeted: ['Latissimus Dorsi', 'Biceps', 'Rear Deltoids', 'Rhomboids', 'Core', 'Forearms'],
    commonMistakes: [
      'Not going full range',
      'Kipping/swinging',
      'Shoulders shrugged at bottom',
      'Chin not clearing bar',
      'No scapular retraction',
      'Elbows flaring forward',
      'Using momentum',
      'Half reps'
    ],
    formTips: [
      'Dead hang at bottom with arms fully extended',
      'Initiate by depressing/retracting scapula',
      'Pull chin clearly over bar',
      'Controlled descent - 2-3 seconds',
      'Slight hollow body position',
      'Elbows drive down and back',
      'Squeeze lats at top'
    ],
    landmarks: {
      leftShoulder: 11,
      rightShoulder: 12,
      leftElbow: 13,
      rightElbow: 14,
      leftWrist: 15,
      rightWrist: 16,
      leftHip: 23,
      rightHip: 24
    },
    validationChecks: [
      {
        id: 'partial_rep',
        name: 'Partial Range of Motion',
        severity: 'medium',
        description: 'Not completing full range - chin not over bar or arms not extending',
        correction: 'Chin must clearly pass bar at top. Arms fully extended at bottom (dead hang).',
        affectedJoints: [13, 14], // elbows
        validate: (landmarks, angles) => {
          return angles.elbowAngle > 140 && angles.elbowAngle < 170;
        }
      },
      {
        id: 'shoulder_shrug',
        name: 'Shoulders Shrugged',
        severity: 'medium',
        description: 'Shoulders elevated at bottom - not engaging lats properly',
        correction: 'At dead hang, actively depress shoulders (pull them down). Initiate pull with scapular depression.',
        affectedJoints: [11, 12], // shoulders
        validate: (landmarks) => {
          // Check if shoulders are elevated relative to ears
          const shoulderY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
          const hipY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
          return (hipY - shoulderY) > 0.4; // Arms extended but shoulders shrugged up
        }
      },
      {
        id: 'excessive_kip',
        name: 'Excessive Kipping',
        severity: 'low',
        description: 'Using body swing/momentum instead of strict pulling',
        correction: 'Keep body still. Engage core with slight hollow position. Pull with lats, not momentum.',
        affectedJoints: [23, 24], // hips
        validate: (landmarks) => {
          // Check for excessive hip movement
          const hipX = (landmarks.leftHip.x + landmarks.rightHip.x) / 2;
          const shoulderX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
          return Math.abs(hipX - shoulderX) > 0.15;
        }
      },
      {
        id: 'elbows_forward',
        name: 'Elbows Coming Forward',
        severity: 'medium',
        description: 'Elbows drifting forward during pull - reduces lat activation',
        correction: 'Drive elbows DOWN and BACK, not forward. Think about putting elbows in back pockets.',
        affectedJoints: [13, 14], // elbows
        validate: (landmarks) => {
          const elbowX = (landmarks.leftElbow.x + landmarks.rightElbow.x) / 2;
          const shoulderX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
          return elbowX > shoulderX + 0.1;
        }
      },
      {
        id: 'chin_not_over',
        name: 'Chin Not Over Bar',
        severity: 'medium',
        description: 'Not pulling high enough - chin below bar level',
        correction: 'Pull until chin clearly passes bar height. Squeeze at top for 1 second.',
        affectedJoints: [11, 12, 13, 14], // shoulders and elbows
        validate: (landmarks, angles) => {
          // At peak contraction, elbows should be very bent
          return angles.elbowAngle > 90 && angles.elbowAngle < 120;
        }
      }
    ]
  }
};

export const EXERCISE_CATEGORIES = {
  lower_body: {
    name: 'Lower Body',
    color: 'red',
    exercises: Object.values(EXERCISES).filter(e => e.category === 'lower_body')
  },
  upper_body: {
    name: 'Upper Body',
    color: 'orange',
    exercises: Object.values(EXERCISES).filter(e => e.category === 'upper_body')
  }
};

export const getExerciseById = (id) => {
  return Object.values(EXERCISES).find(ex => ex.id === id);
};
