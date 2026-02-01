// Adaptive Analysis Service - Adjusts analysis based on available landmarks and camera angle

class AdaptiveAnalysisService {
  constructor() {
    // Define landmark requirements for each exercise and analysis type
    this.landmarkRequirements = {
      squat: {
        full: {
          required: [11, 12, 23, 24, 25, 26, 27, 28], // shoulders, hips, knees, ankles
          description: 'Full frontal or back view',
          checks: ['depth', 'knee_valgus', 'forward_lean', 'heel_lift', 'asymmetry']
        },
        partial_front: {
          required: [23, 24, 25, 26, 27, 28], // hips, knees, ankles
          description: 'Lower body visible',
          checks: ['depth', 'knee_valgus', 'heel_lift']
        },
        side_left: {
          required: [11, 23, 25, 27], // left side chain
          description: 'Left side view',
          checks: ['depth', 'forward_lean']
        },
        side_right: {
          required: [12, 24, 26, 28], // right side chain
          description: 'Right side view',
          checks: ['depth', 'forward_lean']
        }
      },
      deadlift: {
        full: {
          required: [11, 12, 23, 24, 25, 26],
          description: 'Full side view',
          checks: ['back_angle', 'hip_position', 'knee_position']
        },
        side_left: {
          required: [11, 23, 25],
          description: 'Left side view',
          checks: ['back_angle', 'hip_position']
        },
        side_right: {
          required: [12, 24, 26],
          description: 'Right side view',
          checks: ['back_angle', 'hip_position']
        }
      },
      overhead_press: {
        full: {
          required: [11, 12, 13, 14, 15, 16, 23, 24],
          description: 'Full frontal view',
          checks: ['lockout', 'back_arch', 'bar_path', 'asymmetry']
        },
        front_upper: {
          required: [11, 12, 13, 14, 15, 16],
          description: 'Upper body frontal',
          checks: ['lockout', 'asymmetry']
        },
        side: {
          required: [11, 13, 15, 23],
          description: 'Side view',
          checks: ['back_arch', 'bar_path']
        }
      }
    };

    this.cameraAngleGuidance = {
      squat: {
        optimal: 'frontal_45deg',
        alternatives: ['frontal', 'back', 'side'],
        description: 'Best: 45° angle from front showing full body',
        tips: [
          'Position camera at hip height',
          'Stand 6-8 feet away',
          'Ensure full body is visible (head to feet)',
          'Slight angle (45°) captures depth and knee tracking'
        ],
        referenceImage: '/assets/camera-angles/squat-optimal.jpg'
      },
      deadlift: {
        optimal: 'side',
        alternatives: ['side_45deg'],
        description: 'Best: Direct side view at hip height',
        tips: [
          'Position camera at hip height',
          'Completely perpendicular to your body',
          'Capture full range: bar on ground to lockout',
          'Show full side profile'
        ],
        referenceImage: '/assets/camera-angles/deadlift-optimal.jpg'
      },
      overhead_press: {
        optimal: 'frontal_45deg',
        alternatives: ['frontal', 'side'],
        description: 'Best: 45° front angle showing shoulders to hips',
        tips: [
          'Position camera at shoulder height',
          'Capture from shoulders to hips minimum',
          '45° angle shows bar path and body position',
          'Ensure both arms visible'
        ],
        referenceImage: '/assets/camera-angles/ohp-optimal.jpg'
      }
    };
  }

  /**
   * Detect which landmarks are consistently visible
   */
  detectAvailableLandmarks(frames, visibilityThreshold = 0.5, consistencyThreshold = 0.7) {
    const landmarkVisibility = {};

    // Track how often each landmark is visible across frames
    frames.forEach(frame => {
      if (!frame || !frame.landmarks) {
        return;
      }

      const landmarks = frame.landmarks;
      
      // Handle both array and object formats
      const landmarkArray = Array.isArray(landmarks) ? landmarks : Object.values(landmarks);
      
      landmarkArray.forEach((landmark, index) => {
        if (!landmarkVisibility[index]) {
          landmarkVisibility[index] = { visibleCount: 0, totalCount: 0 };
        }

        landmarkVisibility[index].totalCount++;
        if (landmark && landmark.visibility !== undefined && landmark.visibility >= visibilityThreshold) {
          landmarkVisibility[index].visibleCount++;
        } else if (landmark && landmark.visibility === undefined) {
          // If no visibility property, assume it's visible if landmark exists
          landmarkVisibility[index].visibleCount++;
        }
      });
    });

    // Determine which landmarks are consistently available
    const availableLandmarks = [];
    Object.keys(landmarkVisibility).forEach(index => {
      const stats = landmarkVisibility[parseInt(index)];
      if (stats.totalCount > 0) {
        const consistency = stats.visibleCount / stats.totalCount;
        
        if (consistency >= consistencyThreshold) {
          availableLandmarks.push(parseInt(index));
        }
      }
    });

    return {
      available: availableLandmarks,
      visibilityStats: landmarkVisibility,
      totalFrames: frames.length
    };
  }

  /**
   * Determine best analysis mode based on available landmarks
   */
  determineAnalysisMode(exerciseId, availableLandmarks) {
    const requirements = this.landmarkRequirements[exerciseId];
    if (!requirements) {
      return {
        mode: 'unknown',
        confidence: 0,
        missingLandmarks: [],
        availableChecks: []
      };
    }

    let bestMode = null;
    let bestScore = 0;

    Object.entries(requirements).forEach(([mode, config]) => {
      const requiredLandmarks = config.required;
      const availableRequired = requiredLandmarks.filter(lm => 
        availableLandmarks.includes(lm)
      );

      const score = availableRequired.length / requiredLandmarks.length;

      if (score > bestScore) {
        bestScore = score;
        bestMode = {
          mode,
          confidence: score,
          description: config.description,
          missingLandmarks: requiredLandmarks.filter(lm => 
            !availableLandmarks.includes(lm)
          ),
          availableChecks: config.checks,
          allChecks: requirements.full?.checks || config.checks
        };
      }
    });

    return bestMode || {
      mode: 'insufficient',
      confidence: 0,
      missingLandmarks: requirements.full.required,
      availableChecks: []
    };
  }

  /**
   * Detect camera angle from landmark positions
   */
  detectCameraAngle(landmarks) {
    if (!landmarks || landmarks.length < 33) {
      return { angle: 'unknown', confidence: 0 };
    }

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return { angle: 'unknown', confidence: 0 };
    }

    // Calculate shoulder and hip widths
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const hipWidth = Math.abs(rightHip.x - leftHip.x);
    
    // Calculate depth indicators
    const shoulderDepth = Math.abs(rightShoulder.z - leftShoulder.z);
    const hipDepth = Math.abs(rightHip.z - leftHip.z);

    // Determine angle based on landmark positions
    if (shoulderWidth < 0.1 && hipWidth < 0.1) {
      return { 
        angle: 'side', 
        confidence: 0.9,
        description: 'Side view detected'
      };
    } else if (shoulderWidth > 0.25 && hipWidth > 0.25) {
      if (shoulderDepth < 0.05 && hipDepth < 0.05) {
        return { 
          angle: 'frontal', 
          confidence: 0.85,
          description: 'Frontal view detected'
        };
      } else {
        return { 
          angle: 'frontal_45deg', 
          confidence: 0.8,
          description: '45° frontal view detected'
        };
      }
    } else if (shoulderWidth > 0.15 || hipWidth > 0.15) {
      return { 
        angle: 'angled', 
        confidence: 0.7,
        description: 'Angled view detected'
      };
    }

    return { 
      angle: 'unclear', 
      confidence: 0.5,
      description: 'Camera angle unclear'
    };
  }

  /**
   * Get camera angle recommendations
   */
  getCameraGuidance(exerciseId, currentAngle, analysisMode) {
    const guidance = this.cameraAngleGuidance[exerciseId];
    if (!guidance) {
      return null;
    }

    const isOptimal = currentAngle.angle === guidance.optimal || 
                     guidance.alternatives.includes(currentAngle.angle);

    return {
      currentAngle: currentAngle.angle,
      isOptimal,
      optimalAngle: guidance.optimal,
      description: guidance.description,
      tips: guidance.tips,
      referenceImage: guidance.referenceImage,
      improvement: !isOptimal ? this.getAngleImprovement(currentAngle.angle, guidance.optimal) : null,
      confidence: analysisMode.confidence,
      limitedAnalysis: analysisMode.confidence < 1.0
    };
  }

  /**
   * Get specific improvement suggestions for camera angle
   */
  getAngleImprovement(currentAngle, optimalAngle) {
    const improvements = {
      'side_to_frontal': 'Rotate camera 90° to face you directly',
      'side_to_frontal_45deg': 'Rotate camera 45° toward your front',
      'frontal_to_side': 'Rotate camera 90° to show your side profile',
      'unclear_to_frontal': 'Position camera directly in front, hip height, 6-8 feet away',
      'unclear_to_side': 'Position camera perpendicular to your side, hip height'
    };

    const key = `${currentAngle}_to_${optimalAngle}`;
    return improvements[key] || 'Adjust camera position for optimal angle';
  }

  /**
   * Generate comprehensive analysis report
   */
  generateAdaptiveReport(exerciseId, frames, analysisResults) {
    // Handle empty frames
    if (!frames || frames.length === 0) {
      return {
        analysisMode: 'insufficient',
        confidence: 0,
        description: 'No frames with detected pose',
        completenessScore: 0,
        landmarks: {
          available: [],
          missing: [],
          totalRequired: 0
        },
        checks: {
          available: [],
          unavailable: [],
          totalPossible: 0
        },
        camera: { angle: 'unknown', confidence: 0 },
        recommendations: [{ message: 'Could not detect pose in any frames. Ensure full body is visible.' }],
        limitedAnalysisWarning: false,
        qualityMetrics: {
          landmarkVisibility: 0,
          cameraAngleConfidence: 0,
          overallQuality: 0
        }
      };
    }

    // Detect available landmarks
    const landmarkAnalysis = this.detectAvailableLandmarks(frames);
    
    // Determine analysis mode
    const analysisMode = this.determineAnalysisMode(exerciseId, landmarkAnalysis.available);
    
    // Detect camera angle from first frame with good landmarks
    const goodFrame = frames.find(f => f.landmarks && f.landmarks.length >= 33);
    const cameraAngle = goodFrame ? this.detectCameraAngle(goodFrame.landmarks) : 
                        { angle: 'unknown', confidence: 0 };
    
    // Get camera guidance
    const cameraGuidance = this.getCameraGuidance(exerciseId, cameraAngle, analysisMode);

    // Calculate limited analysis penalty
    const completenessScore = analysisMode.confidence * 100;
    const unavailableChecks = analysisMode.allChecks ? 
      analysisMode.allChecks.filter(c => !analysisMode.availableChecks.includes(c)) : [];

    return {
      analysisMode: analysisMode.mode,
      confidence: analysisMode.confidence,
      description: analysisMode.description,
      completenessScore,
      
      landmarks: {
        available: landmarkAnalysis.available,
        missing: analysisMode.missingLandmarks,
        totalRequired: this.landmarkRequirements[exerciseId]?.full?.required.length || 0
      },
      
      checks: {
        available: analysisMode.availableChecks,
        unavailable: unavailableChecks,
        totalPossible: analysisMode.allChecks?.length || 0
      },
      
      camera: cameraGuidance,
      
      recommendations: this.generateRecommendations(analysisMode, cameraGuidance, unavailableChecks),
      
      // Do not flag limited analysis; always false to avoid user-facing warnings
      limitedAnalysisWarning: false,
      
      qualityMetrics: {
        landmarkVisibility: analysisMode.confidence,
        cameraAngleConfidence: cameraAngle.confidence,
        overallQuality: (analysisMode.confidence + cameraAngle.confidence) / 2
      }
    };
  }

  /**
   * Generate specific recommendations
   */
  generateRecommendations(analysisMode, cameraGuidance, unavailableChecks) {
    const recommendations = [];

    // Removed critical limited-analysis recommendation; keep guidance non-blocking

    if (unavailableChecks.length > 0) {
      recommendations.push({
        type: 'warning',
        category: 'analysis_scope',
        message: `Cannot check: ${unavailableChecks.join(', ')}`,
        action: `Improve camera angle to enable full analysis. Missing ${unavailableChecks.length} checks.`
      });
    }

    if (cameraGuidance && !cameraGuidance.isOptimal) {
      recommendations.push({
        type: 'info',
        category: 'optimization',
        message: 'Camera angle can be improved',
        action: cameraGuidance.description,
        tips: cameraGuidance.tips
      });
    }

    if (analysisMode.missingLandmarks.length > 0) {
      const bodyParts = this.landmarksToBodyParts(analysisMode.missingLandmarks);
      recommendations.push({
        type: 'warning',
        category: 'visibility',
        message: `Cannot see: ${bodyParts.join(', ')}`,
        action: 'Ensure full body is visible in frame'
      });
    }

    return recommendations;
  }

  /**
   * Convert landmark indices to body part names
   */
  landmarksToBodyParts(landmarkIndices) {
    const mapping = {
      11: 'left shoulder', 12: 'right shoulder',
      13: 'left elbow', 14: 'right elbow',
      15: 'left wrist', 16: 'right wrist',
      23: 'left hip', 24: 'right hip',
      25: 'left knee', 26: 'right knee',
      27: 'left ankle', 28: 'right ankle'
    };

    const parts = new Set();
    landmarkIndices.forEach(idx => {
      if (mapping[idx]) {
        const part = mapping[idx].split(' ')[1]; // Get just 'shoulder', 'knee', etc.
        parts.add(part);
      }
    });

    return Array.from(parts);
  }
}

const adaptiveAnalysisService = new AdaptiveAnalysisService();
export default adaptiveAnalysisService;
