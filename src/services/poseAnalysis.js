// Pose Analysis Service - Comprehensive MediaPipe integration with motion detection
// Combines core analysis with enhanced features for exercise detection and visualization

import { EXERCISES } from '../config/exercises';

class PoseAnalysisService {
  constructor() {
    this.pose = null;
    this.isInitialized = false;
  }

  isUsableLandmark(landmark) {
    return (
      !!landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y)
    );
  }

  getExerciseById(exerciseId) {
    if (!exerciseId) return null;
    return Object.values(EXERCISES).find(ex => ex?.id === exerciseId) || null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if MediaPipe Pose is available
      if (typeof window.Pose === 'undefined') {
        throw new Error('MediaPipe Pose not loaded');
      }

      this.pose = new window.Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe Pose:', error);
      throw error;
    }
  }

  // Core math utilities
  calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  calculateDistance(a, b) {
    if (!a || !b) return 0;
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  }

  /**
   * Calculate virtual mid-back point by interpolating between shoulders and hips
   * This creates a synthetic landmark for checking back rounding
   */
  calculateMidBack(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;
    
    // Mid-point between shoulders
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2
    };
    
    // Mid-point between hips
    const midHip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2
    };
    
    // Mid-back is at ~40% from hips toward shoulders (lower thoracic spine)
    const v = (lm) => (typeof lm?.visibility === 'number' ? lm.visibility : 1);

    return {
      x: midHip.x + (midShoulder.x - midHip.x) * 0.4,
      y: midHip.y + (midShoulder.y - midHip.y) * 0.4,
      z: midHip.z + (midShoulder.z - midHip.z) * 0.4,
      visibility: Math.min(v(leftShoulder), v(rightShoulder), v(leftHip), v(rightHip))
    };
  }

  /**
   * Calculate back rounding (excessive thoracic/lumbar flexion)
   * Measures deviation of mid-back from the shoulder-hip line
   */
  calculateBackRounding(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;
    
    const midBack = this.calculateMidBack(landmarks);
    if (!midBack) return null;
    
    // Calculate expected mid-back position on a straight line
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    const midHip = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    const expectedMidBack = {
      x: midHip.x + (midShoulder.x - midHip.x) * 0.4,
      y: midHip.y + (midShoulder.y - midHip.y) * 0.4
    };
    
    // Use z-coordinate (depth) if available for more accurate detection
    // Positive deviation = back rounding (spine moving away from camera in sagittal view)
    const zDeviation = midBack.z - ((leftShoulder.z || 0) + (leftHip.z || 0)) / 2;
    
    // Also check x-deviation for frontal view
    const xDeviation = midBack.x - expectedMidBack.x;
    
    return {
      midBack,
      zDeviation,  // Depth deviation (positive = rounding)
      xDeviation,  // Lateral deviation
      // More lenient thresholds to reduce false positives
      isRounded: zDeviation > 0.14 || Math.abs(xDeviation) > 0.16
    };
  }

  /**
   * Check hip position relative to shoulder-hip-knee alignment
   * For squat: hips too far back creates shallow angle
   */
  calculateHipPosition(landmarks) {
    const leftShoulder = landmarks[11];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    
    if (!leftShoulder || !leftHip || !leftKnee) return null;
    
    // Calculate angle at hip between shoulder-hip and hip-knee lines
    const shoulderHipKneeAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
    
    // Check horizontal offset: hip x relative to knee x
    const hipKneeHorizontalOffset = leftHip.x - leftKnee.x;
    
    // Hips too far back if:
    // 1. Angle is too shallow (< 75 degrees at bottom of squat - relaxed from 85)
    // 2. Hip is significantly behind the knee horizontally (relaxed threshold)
    const hipsTooFarBack = shoulderHipKneeAngle < 75 || hipKneeHorizontalOffset > 0.12;
    
    return {
      shoulderHipKneeAngle,
      hipKneeHorizontalOffset,
      hipsTooFarBack
    };
  }

  getLandmarksByConfig(landmarks, config) {
    const result = {};
    for (const [key, index] of Object.entries(config)) {
      result[key] = landmarks[index];
    }
    return result;
  }

  // Validation utilities
  checkVisibility(landmarks, requiredIndices, threshold = 0.3) {
    // Extremely lenient: allow analysis if any required landmark has usable coordinates.
    // (Do not gate analysis on MediaPipe visibility scores.)
    if (!Array.isArray(landmarks)) return false;
    for (const index of requiredIndices) {
      if (this.isUsableLandmark(landmarks[index])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get array of available landmark indices that are visible
   */
  getAvailableLandmarks(landmarks, requiredIndices, threshold = 0.3) {
    return requiredIndices.filter(index => {
      const lm = landmarks[index];
      if (!this.isUsableLandmark(lm)) return false;
      if (typeof lm.visibility !== 'number') return true;
      return lm.visibility >= threshold;
    });
  }

  /**
   * Count how many landmarks are visible in the current frame
   * Only counts landmarks with visibility > threshold
   */
  countVisibleLandmarks(landmarks, threshold = 0.3) {
    if (!Array.isArray(landmarks)) return 0;
    return landmarks.filter(lm => {
      if (!this.isUsableLandmark(lm)) return false;
      if (typeof lm.visibility !== 'number') return true;
      return lm.visibility > threshold;
    }).length;
  }

  // Motion analysis
  detectMotion(frames, threshold = 0.05) {
    if (frames.length < 2) return false;

    let totalMovement = 0;
    const keyPoints = [11, 12, 23, 24]; // shoulders and hips
    
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].landmarks;
      const curr = frames[i].landmarks;

      // Track movement of key points (hips and shoulders)
      for (let j = 0; j < keyPoints.length; j++) {
        const idx = keyPoints[j];
        if (prev[idx] && curr[idx]) {
          const dx = curr[idx].x - prev[idx].x;
          const dy = curr[idx].y - prev[idx].y;
          totalMovement += Math.sqrt(dx * dx + dy * dy);
        }
      }
    }

    const avgMovement = totalMovement / (frames.length - 1);
    return avgMovement > threshold;
  }

  // Exercise phase detection
  detectExercisePhases(frames, exerciseId) {
    if (frames.length < 3) return false;

    if (exerciseId === 'squat' || exerciseId === 'deadlift') {
      // Track hip height over time
      const hipHeights = frames.map(f => {
        const leftHip = f.landmarks[23];
        const rightHip = f.landmarks[24];
        return ((leftHip?.y || 0) + (rightHip?.y || 0)) / 2;
      });

      const maxHeight = Math.max(...hipHeights);
      const minHeight = Math.min(...hipHeights);
      const range = maxHeight - minHeight;

      // Must have at least 0.15 (15% of frame) vertical movement
      return range > 0.15;
    }

    if (exerciseId === 'overhead_press') {
      // Track hand height
      const handHeights = frames.map(f => {
        const leftWrist = f.landmarks[15];
        const rightWrist = f.landmarks[16];
        return ((leftWrist?.y || 0) + (rightWrist?.y || 0)) / 2;
      });

      const maxHeight = Math.max(...handHeights);
      const minHeight = Math.min(...handHeights);
      const range = maxHeight - minHeight;

      return range > 0.2; // Hands must move significantly
    }

    return true; // Default: assume exercise is being performed
  }

  // Exercise-specific analysis methods
  analyzeSquat(landmarks) {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const result = {
      kneeAngle: null,
      leftKneeAngle: null,
      rightKneeAngle: null,
      hipAngle: null,
      asymmetry: null,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      backRounding: null,
      midBack: null,
      hipPosition: null
    };

    // Calculate angles only if required landmarks are available
    if (this.isUsableLandmark(leftHip) && this.isUsableLandmark(leftKnee) && this.isUsableLandmark(leftAnkle)) {
      result.leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
    }
    if (this.isUsableLandmark(rightHip) && this.isUsableLandmark(rightKnee) && this.isUsableLandmark(rightAnkle)) {
      result.rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);
    }
    if (result.leftKneeAngle && result.rightKneeAngle) {
      result.kneeAngle = (result.leftKneeAngle + result.rightKneeAngle) / 2;
      result.asymmetry = Math.abs(result.leftKneeAngle - result.rightKneeAngle);
    }

    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftHip) && this.isUsableLandmark(leftKnee)) {
      result.hipAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
    }
    
    // Calculate mid-back position for rounding detection if shoulders and hips available
    if (
      this.isUsableLandmark(leftShoulder) &&
      this.isUsableLandmark(rightShoulder) &&
      this.isUsableLandmark(leftHip) &&
      this.isUsableLandmark(rightHip)
    ) {
      result.backRounding = this.calculateBackRounding(landmarks);
      result.midBack = this.calculateMidBack(landmarks);
    }
    
    // Calculate hip position if available
    if (this.isUsableLandmark(leftHip) && this.isUsableLandmark(rightHip)) {
      result.hipPosition = this.calculateHipPosition(landmarks);
    }

    return result;
  }

  analyzeDeadlift(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    const result = {
      backAngle: null,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      backRounding: null,
      midBack: null
    };

    // Calculate mid-back for rounding detection if all required landmarks available
    if (
      this.isUsableLandmark(leftShoulder) &&
      this.isUsableLandmark(rightShoulder) &&
      this.isUsableLandmark(leftHip) &&
      this.isUsableLandmark(rightHip)
    ) {
      result.backRounding = this.calculateBackRounding(landmarks);
      result.midBack = this.calculateMidBack(landmarks);
    }

    // Calculate back angle if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftHip) && this.isUsableLandmark(leftKnee)) {
      result.backAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
    }

    return result;
  }

  analyzeOverheadPress(landmarks) {
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];

    const result = {
      elbowAngle: null,
      leftElbowAngle: null,
      rightElbowAngle: null,
      bodyAngle: null,
      leftShoulder,
      leftElbow,
      leftWrist,
      leftHip,
      backRounding: null,
      midBack: null
    };

    // Calculate mid-back for rounding detection if all required landmarks available
    if (
      this.isUsableLandmark(leftShoulder) &&
      this.isUsableLandmark(rightShoulder) &&
      this.isUsableLandmark(landmarks[23]) &&
      this.isUsableLandmark(landmarks[24])
    ) {
      result.backRounding = this.calculateBackRounding(landmarks);
      result.midBack = this.calculateMidBack(landmarks);
    }

    // Calculate elbow angles if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftElbow) && this.isUsableLandmark(leftWrist)) {
      result.leftElbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    }
    if (this.isUsableLandmark(rightShoulder) && this.isUsableLandmark(rightElbow) && this.isUsableLandmark(rightWrist)) {
      result.rightElbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
    }
    if (result.leftElbowAngle && result.rightElbowAngle) {
      result.elbowAngle = (result.leftElbowAngle + result.rightElbowAngle) / 2;
    }

    // Calculate body angle if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftHip)) {
      result.bodyAngle = this.calculateAngle(leftShoulder, leftHip, { x: leftHip.x, y: leftHip.y + 1 });
    }

    return result;
  }

  analyzeBenchPress(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const result = {
      elbowAngle: null,
      leftElbowAngle: null,
      rightElbowAngle: null,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow
    };

    // Calculate elbow angles if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftElbow) && this.isUsableLandmark(leftWrist)) {
      result.leftElbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    }
    if (this.isUsableLandmark(rightShoulder) && this.isUsableLandmark(rightElbow) && this.isUsableLandmark(rightWrist)) {
      result.rightElbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
    }
    if (result.leftElbowAngle && result.rightElbowAngle) {
      result.elbowAngle = (result.leftElbowAngle + result.rightElbowAngle) / 2;
    }

    return result;
  }

  analyzePullUp(landmarks) {
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];

    const result = {
      elbowAngle: null,
      bodyAngle: null,
      leftShoulder,
      leftElbow,
      leftWrist,
      leftHip
    };

    // Calculate elbow angle if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftElbow) && this.isUsableLandmark(leftWrist)) {
      result.elbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    }

    // Calculate body angle if available
    if (this.isUsableLandmark(leftShoulder) && this.isUsableLandmark(leftHip)) {
      result.bodyAngle = this.calculateAngle(leftShoulder, leftHip, { x: leftHip.x, y: leftHip.y + 1 });
    }

    return result;
  }

  analyzeExercise(exerciseId, landmarks) {
    const analysisMap = {
      squat: () => this.analyzeSquat(landmarks),
      deadlift: () => this.analyzeDeadlift(landmarks),
      overhead_press: () => this.analyzeOverheadPress(landmarks),
      bench_press: () => this.analyzeBenchPress(landmarks),
      pull_up: () => this.analyzePullUp(landmarks)
    };

    const analyzeFn = analysisMap[exerciseId];
    const result = analyzeFn ? analyzeFn() : {};
    return result || {};
  }

  async analyzeFrame(imageData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.pose.onResults((results) => {
        resolve(results);
      });

      this.pose.send({ image: imageData }).catch(reject);
    });
  }

  validateForm(exerciseOrId, landmarks, angles) {
    const errors = [];

    const exercise =
      typeof exerciseOrId === 'string'
        ? this.getExerciseById(exerciseOrId)
        : exerciseOrId;

    const checks = exercise?.validationChecks || [];

    checks.forEach(check => {
      try {
        if (check.validate(landmarks, angles)) {
          errors.push({
            id: check.id,
            name: check.name,
            severity: check.severity,
            description: check.description,
            correction: check.correction,
            affectedJoints: check.affectedJoints || []
          });
        }
      } catch (error) {
        console.error(`Validation check ${check.id} failed:`, error);
      }
    });

    return errors;
  }

  // Visualization utility - draw skeleton overlay
  drawSkeleton(canvas, landmarks, errors = []) {
    if (!canvas || !landmarks) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Define skeleton connections
    const connections = [
      // Torso
      [11, 12], // shoulders
      [11, 23], // left shoulder to hip
      [12, 24], // right shoulder to hip
      [23, 24], // hips
      
      // Left arm
      [11, 13], // shoulder to elbow
      [13, 15], // elbow to wrist
      
      // Right arm
      [12, 14],
      [14, 16],
      
      // Left leg
      [23, 25], // hip to knee
      [25, 27], // knee to ankle
      
      // Right leg
      [24, 26],
      [26, 28],
      
      // Face (optional)
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8]
    ];

    // Determine which joints have errors (for highlighting)
    const errorJoints = new Set();
    errors.forEach(error => {
      if (error.affectedJoints) {
        error.affectedJoints.forEach(joint => errorJoints.add(joint));
      }
    });

    // Check if there's a back rounding error
    const hasBackRoundingError = errors.some(e => 
      e.id?.includes('back_rounding') || e.id?.includes('mid_back') || e.id === 'rounded_back'
    );

    // Draw connections
    ctx.lineWidth = 3;
    connections.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end] && 
          landmarks[start].visibility > 0.3 && landmarks[end].visibility > 0.3) {
        const hasError = errorJoints.has(start) || errorJoints.has(end);
        
        ctx.beginPath();
        ctx.moveTo(
          landmarks[start].x * canvas.width,
          landmarks[start].y * canvas.height
        );
        ctx.lineTo(
          landmarks[end].x * canvas.width,
          landmarks[end].y * canvas.height
        );
        ctx.strokeStyle = hasError ? '#ff4444' : '#00ff00';
        ctx.stroke();
      }
    });

    // Draw mid-back point if we can calculate it
    const midBack = this.calculateMidBack(landmarks);
    if (midBack && midBack.visibility > 0.3) {
      // Draw spine line through mid-back
      const midShoulder = {
        x: (landmarks[11].x + landmarks[12].x) / 2,
        y: (landmarks[11].y + landmarks[12].y) / 2
      };
      const midHip = {
        x: (landmarks[23].x + landmarks[24].x) / 2,
        y: (landmarks[23].y + landmarks[24].y) / 2
      };
      
      // Draw spine line
      ctx.beginPath();
      ctx.moveTo(midShoulder.x * canvas.width, midShoulder.y * canvas.height);
      ctx.lineTo(midBack.x * canvas.width, midBack.y * canvas.height);
      ctx.lineTo(midHip.x * canvas.width, midHip.y * canvas.height);
      ctx.strokeStyle = hasBackRoundingError ? '#ff4444' : '#ffff00';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Draw mid-back point
      ctx.beginPath();
      ctx.arc(
        midBack.x * canvas.width,
        midBack.y * canvas.height,
        hasBackRoundingError ? 10 : 7,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = hasBackRoundingError ? '#ff4444' : '#ffff00';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw joints
    landmarks.forEach((landmark, i) => {
      if (landmark && landmark.visibility > 0.3) {
        const hasError = errorJoints.has(i);
        
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          hasError ? 8 : 5,
          0,
          2 * Math.PI
        );
        
        // Color based on visibility and error state
        if (hasError) {
          ctx.fillStyle = '#ff4444';
        } else if (landmark.visibility > 0.7) {
          ctx.fillStyle = '#00ffff';
        } else {
          ctx.fillStyle = '#888888';
        }
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }
}

const poseAnalysisService = new PoseAnalysisService();
export default poseAnalysisService;
