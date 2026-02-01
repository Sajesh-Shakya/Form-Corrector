// Enhanced Pose Analysis Service with motion detection and visualization

class PoseAnalysisService {
  constructor() {
    this.pose = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
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

  // NEW: Check if landmarks are visible enough for analysis
  checkVisibility(landmarks, requiredIndices) {
    for (const index of requiredIndices) {
      if (!landmarks[index] || landmarks[index].visibility < 0.5) {
        return false;
      }
    }
    return true;
  }

  // NEW: Detect if person is actually moving (not just standing still)
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

  // NEW: Detect exercise phases (e.g., eccentric and concentric for squats)
  detectExercisePhases(frames, exerciseId) {
    if (frames.length < 3) return false;

    if (exerciseId === 'squat' || exerciseId === 'deadlift') {
      // Track hip height over time
      const hipHeights = frames.map(f => {
        const leftHip = f.landmarks[23];
        const rightHip = f.landmarks[24];
        return ((leftHip.y + rightHip.y) / 2);
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
        return ((leftWrist.y + rightWrist.y) / 2);
      });

      const maxHeight = Math.max(...handHeights);
      const minHeight = Math.min(...handHeights);
      const range = maxHeight - minHeight;

      return range > 0.2; // Hands must move significantly
    }

    return true; // Default: assume exercise is being performed
  }

  analyzeSquat(landmarks) {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    // Check visibility
    if (!this.checkVisibility(landmarks, [11, 12, 23, 24, 25, 26, 27, 28])) {
      return null;
    }

    // Calculate angles for both sides
    const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);
    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

    const hipAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);

    // Check asymmetry
    const asymmetry = Math.abs(leftKneeAngle - rightKneeAngle);

    return {
      kneeAngle,
      leftKneeAngle,
      rightKneeAngle,
      hipAngle,
      asymmetry,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip
    };
  }

  analyzeDeadlift(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    if (!this.checkVisibility(landmarks, [11, 12, 23, 24, 25, 26])) {
      return null;
    }

    const backAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);

    return {
      backAngle,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee
    };
  }

  analyzeOverheadPress(landmarks) {
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];

    if (!this.checkVisibility(landmarks, [11, 12, 13, 14, 15, 16, 23])) {
      return null;
    }

    const leftElbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
    const elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    const bodyAngle = this.calculateAngle(leftShoulder, leftHip, { x: leftHip.x, y: leftHip.y + 1 });

    return {
      elbowAngle,
      leftElbowAngle,
      rightElbowAngle,
      bodyAngle,
      leftShoulder,
      leftElbow,
      leftWrist,
      leftHip
    };
  }

  analyzeBenchPress(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!this.checkVisibility(landmarks, [11, 12, 13, 14, 15, 16])) {
      return null;
    }

    const leftElbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);
    const elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    return {
      elbowAngle,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow
    };
  }

  analyzePullUp(landmarks) {
    const leftShoulder = landmarks[11];
    const leftElbow = landmarks[13];
    const leftWrist = landmarks[15];
    const leftHip = landmarks[23];

    if (!this.checkVisibility(landmarks, [11, 13, 15, 23])) {
      return null;
    }

    const elbowAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    const bodyAngle = this.calculateAngle(leftShoulder, leftHip, { x: leftHip.x, y: leftHip.y + 1 });

    return {
      elbowAngle,
      bodyAngle,
      leftShoulder,
      leftElbow,
      leftWrist,
      leftHip
    };
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
    return analyzeFn ? analyzeFn() : null;
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

  validateForm(exercise, landmarks, angles) {
    const errors = [];

    exercise.validationChecks.forEach(check => {
      try {
        if (check.validate(landmarks, angles)) {
          errors.push({
            id: check.id,
            name: check.name,
            severity: check.severity,
            description: check.description,
            correction: check.correction
          });
        }
      } catch (error) {
        console.error(`Validation check ${check.id} failed:`, error);
      }
    });

    return errors;
  }

  // NEW: Draw skeleton overlay on canvas
  drawSkeleton(canvas, landmarks, errors = []) {
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
      [26, 28]
    ];

    // Draw connections
    connections.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end]) {
        ctx.beginPath();
        ctx.moveTo(
          landmarks[start].x * canvas.width,
          landmarks[start].y * canvas.height
        );
        ctx.lineTo(
          landmarks[end].x * canvas.width,
          landmarks[end].y * canvas.height
        );
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Draw joints
    landmarks.forEach((landmark, i) => {
      if (landmark) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          6,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = landmark.visibility > 0.5 ? '#00ffff' : '#888888';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }
}

const poseAnalysisEnhancedService = new PoseAnalysisService();
export default poseAnalysisEnhancedService;
