// Rep Progression Analysis - Tracks angle and distance changes through each phase
// Analyzes movement quality based on progression patterns, not just individual frames

class RepProgressionService {
  constructor() {
    this.exercisePatterns = {
      squat: {
        phases: ['bottom', 'ascent', 'top', 'descent'],
        primaryMetric: 'kneeAngle',
        optimalRange: { min: 60, max: 175 },
        phaseRanges: {
          descent: { start: 175, end: 60, duration: 0.5 },     // eccentric phase
          bottom: { range: 5, duration: 0.2 },                  // pause at bottom
          ascent: { start: 60, end: 175, duration: 0.5 }        // concentric phase
        },
        keyMetrics: ['kneeAngle', 'hipAngle', 'asymmetry', 'kneeForwardTravel']
      },
      deadlift: {
        phases: ['bottom', 'ascent', 'top', 'descent'],
        primaryMetric: 'backAngle',
        optimalRange: { min: 155, max: 180 },
        phaseRanges: {
          ascent: { start: 155, end: 180, duration: 0.6 },      // concentric: spine straightens
          top: { range: 2, duration: 0.2 },                      // lockout
          descent: { start: 180, end: 155, duration: 0.6 }       // eccentric: controlled lowering
        },
        keyMetrics: ['backAngle', 'hipPosition', 'shoulderPosition']
      },
      overhead_press: {
        phases: ['bottom', 'drive', 'overhead', 'descent'],
        primaryMetric: 'elbowAngle',
        optimalRange: { min: 60, max: 180 },
        phaseRanges: {
          drive: { start: 60, end: 120, duration: 0.3 },        // pressing phase
          overhead: { start: 120, end: 180, duration: 0.3 },    // lockout phase
          descent: { start: 180, end: 60, duration: 0.4 }       // controlled descent
        },
        keyMetrics: ['elbowAngle', 'bodyAngle', 'wristAlignment']
      },
      bench_press: {
        phases: ['top', 'descent', 'bottom', 'ascent'],
        primaryMetric: 'elbowAngle',
        optimalRange: { min: 60, max: 170 },
        phaseRanges: {
          descent: { start: 170, end: 60, duration: 0.4 },      // eccentric: controlled
          bottom: { range: 5, duration: 0.1 },                   // pause at chest
          ascent: { start: 60, end: 170, duration: 0.3 }         // concentric: explosive
        },
        keyMetrics: ['elbowAngle', 'elbowFlare', 'wristAlignment', 'symmetry']
      },
      pull_up: {
        phases: ['bottom', 'ascent', 'top', 'descent'],
        primaryMetric: 'elbowAngle',
        optimalRange: { min: 20, max: 180 },
        phaseRanges: {
          ascent: { start: 180, end: 30, duration: 0.5 },       // pulling up
          top: { range: 5, duration: 0.2 },                      // chin over bar
          descent: { start: 30, end: 180, duration: 0.5 }        // controlled descent
        },
        keyMetrics: ['elbowAngle', 'shoulderEngagement', 'bodySwing']
      }
    };
  }

  /**
   * Analyze a complete rep from start to finish
   * Returns progression data with phase-specific feedback
   */
  analyzeRepProgression(repFrames, exerciseId) {
    const pattern = this.exercisePatterns[exerciseId];
    if (!pattern) return null;

    const analysis = {
      exerciseId,
      totalDuration: repFrames.length > 0 ? repFrames[repFrames.length - 1].time : 0,
      frameCount: repFrames.length,
      phases: {},
      issues: [],
      quality: {
        smoothness: 0,        // Measure of consistent velocity
        symmetry: 0,          // Left/right balance
        controlledTempo: 0,   // Eccentric vs concentric ratio
        consistencyAcrossReps: 0
      },
      metrics: {}
    };

    // Extract metric progression
    const metricProgression = this.extractMetricProgression(repFrames, pattern.primaryMetric);
    analysis.metrics[pattern.primaryMetric] = metricProgression;

    // Identify movement phases
    const phases = this.identifyPhases(metricProgression, repFrames, pattern);
    analysis.phases = phases;

    // Analyze each phase
    Object.keys(phases).forEach(phaseName => {
      const phase = phases[phaseName];
      if (phase.frameIndices.length > 0) {
        const phaseFrames = phase.frameIndices.map(i => repFrames[i]);
        analysis.issues.push(...this.analyzePhaseQuality(phaseFrames, phaseName, exerciseId, pattern));
      }
    });

    // Calculate quality scores
    analysis.quality.smoothness = this.calculateSmoothness(metricProgression);
    analysis.quality.symmetry = this.calculateSymmetry(repFrames);
    analysis.quality.controlledTempo = this.analyzeTempoControl(phases);

    return analysis;
  }

  /**
   * Extract how a metric changes throughout the rep
   */
  extractMetricProgression(frames, metric) {
    return frames.map((frame, index) => {
      let value = null;

      switch (metric) {
        case 'kneeAngle':
          if (frame.kneeAngle !== undefined) value = frame.kneeAngle;
          break;
        case 'hipAngle':
          if (frame.hipAngle !== undefined) value = frame.hipAngle;
          break;
        case 'backAngle':
          if (frame.backAngle !== undefined) value = frame.backAngle;
          break;
        case 'elbowAngle':
          if (frame.elbowAngle !== undefined) value = frame.elbowAngle;
          break;
        case 'asymmetry':
          if (frame.asymmetry !== undefined) value = frame.asymmetry;
          break;
        default:
          // Unknown metric, value remains null
          break;
      }

      return {
        index,
        time: frame.time,
        value,
        frame
      };
    });
  }

  /**
   * Identify which phase of movement we're in at each frame
   * Phases: eccentric (lowering/lengthening) vs concentric (raising/shortening)
   */
  identifyPhases(metricProgression, frames, pattern) {
    const phases = {};
    pattern.phases.forEach(phase => {
      phases[phase] = {
        frameIndices: [],
        startValue: null,
        endValue: null,
        duration: 0,
        peakDeviation: 0
      };
    });

    let currentPhaseIndex = 0;
    let previousValue = metricProgression[0]?.value || 0;
    let isDecreasing = true;

    for (let i = 1; i < metricProgression.length; i++) {
      const current = metricProgression[i].value;
      
      if (current === null) continue;

      // Determine movement direction (up or down)
      const isMovingDown = current < previousValue;
      
      // Identify phase transitions
      if (isMovingDown !== isDecreasing) {
        currentPhaseIndex = (currentPhaseIndex + 1) % pattern.phases.length;
        isDecreasing = isMovingDown;
      }

      const phase = pattern.phases[currentPhaseIndex];
      phases[phase].frameIndices.push(i);
      previousValue = current;
    }

    return phases;
  }

  /**
   * Analyze quality issues specific to a movement phase
   */
  analyzePhaseQuality(phaseFrames, phaseName, exerciseId, pattern) {
    const issues = [];

    if (phaseName.includes('descent') || phaseName.includes('descent')) {
      // Check for control during eccentric phase
      const velocities = this.calculateVelocities(phaseFrames, pattern.primaryMetric);
      const maxVelocity = Math.max(...velocities.map(v => Math.abs(v)));
      
      if (maxVelocity > 20) { // Arbitrary unit
        issues.push({
          phase: phaseName,
          type: 'uncontrolledMovement',
          severity: 'high',
          description: `Uncontrolled movement during ${phaseName} phase`,
          correction: 'Slow down the eccentric (lowering) phase. Count 2-3 seconds for control.',
          affectedJoints: []
        });
      }
    }

    if (phaseName.includes('ascent') || phaseName.includes('drive')) {
      // Check for explosive/powerful concentric
      const velocities = this.calculateVelocities(phaseFrames, pattern.primaryMetric);
      const maxVelocity = Math.max(...velocities.map(v => Math.abs(v)));
      
      if (maxVelocity < 3) {
        issues.push({
          phase: phaseName,
          type: 'slowConcentric',
          severity: 'low',
          description: `${phaseName} phase appears slow`,
          correction: 'Increase power and speed during the lifting phase.',
          affectedJoints: []
        });
      }
    }

    return issues;
  }

  /**
   * Calculate angular velocity between frames
   */
  calculateVelocities(frames, metric) {
    const velocities = [];
    
    for (let i = 1; i < frames.length; i++) {
      const current = frames[i][metric];
      const previous = frames[i - 1][metric];
      
      if (current !== undefined && previous !== undefined) {
        const velocity = current - previous;
        velocities.push(velocity);
      }
    }

    return velocities;
  }

  /**
   * Smoothness score: penalizes jerky movements and accelerations
   */
  calculateSmoothness(metricProgression) {
    const validPoints = metricProgression.filter(p => p.value !== null);
    if (validPoints.length < 3) return 100;

    let totalAcceleration = 0;
    const velocities = [];

    // Calculate velocities
    for (let i = 1; i < validPoints.length; i++) {
      const v = validPoints[i].value - validPoints[i - 1].value;
      velocities.push(v);
    }

    // Calculate accelerations (change in velocity)
    for (let i = 1; i < velocities.length; i++) {
      const acceleration = Math.abs(velocities[i] - velocities[i - 1]);
      totalAcceleration += acceleration;
    }

    const avgAcceleration = totalAcceleration / velocities.length;
    // Higher acceleration = lower smoothness
    const smoothness = Math.max(0, 100 - avgAcceleration * 5);
    
    return Math.round(smoothness);
  }

  /**
   * Symmetry score: checks left/right balance
   */
  calculateSymmetry(frames) {
    let totalAsymmetry = 0;
    let count = 0;

    frames.forEach(frame => {
      if (frame.asymmetry !== undefined) {
        totalAsymmetry += frame.asymmetry;
        count++;
      }
    });

    if (count === 0) return 100;

    const avgAsymmetry = totalAsymmetry / count;
    // Asymmetry > 10° is poor, < 5° is good
    const symmetry = Math.max(0, 100 - avgAsymmetry * 10);
    
    return Math.round(symmetry);
  }

  /**
   * Tempo control: optimal ratio between eccentric and concentric phases
   */
  analyzeTempoControl(phases) {
    const descentPhases = Object.keys(phases).filter(p => p.includes('descent'));
    const ascentPhases = Object.keys(phases).filter(p => p.includes('ascent') || p.includes('drive'));

    const totalDescentFrames = descentPhases.reduce((sum, p) => sum + phases[p].frameIndices.length, 0);
    const totalAscentFrames = ascentPhases.reduce((sum, p) => sum + phases[p].frameIndices.length, 0);

    if (totalDescentFrames === 0 || totalAscentFrames === 0) return 50;

    // Ideal: eccentric is 1.5x-2x concentric
    const ratio = totalDescentFrames / totalAscentFrames;
    const idealRatio = 1.75;
    
    // Score based on how close to ideal
    const deviation = Math.abs(ratio - idealRatio) / idealRatio;
    const score = Math.max(0, 100 - deviation * 100);

    return Math.round(score);
  }

  /**
   * Compare progression between multiple reps to find consistency issues
   */
  compareRepProgression(repAnalyses) {
    if (repAnalyses.length < 2) return null;

    const consistency = {
      totalReps: repAnalyses.length,
      averageQuality: 0,
      fatigueDetected: false,
      formBreakdown: [],
      recommendations: []
    };

    // Calculate average quality metrics
    const avgSmoothness = repAnalyses.reduce((sum, r) => sum + r.quality.smoothness, 0) / repAnalyses.length;
    const avgSymmetry = repAnalyses.reduce((sum, r) => sum + r.quality.symmetry, 0) / repAnalyses.length;
    const avgTempo = repAnalyses.reduce((sum, r) => sum + r.quality.controlledTempo, 0) / repAnalyses.length;

    consistency.averageQuality = Math.round((avgSmoothness + avgSymmetry + avgTempo) / 3);

    // Detect fatigue (decline in quality across reps)
    if (repAnalyses.length >= 3) {
      const lastThird = repAnalyses.slice(Math.floor(repAnalyses.length * 2 / 3));
      const firstThird = repAnalyses.slice(0, Math.floor(repAnalyses.length / 3));

      const lastQuality = lastThird.reduce((sum, r) => sum + r.quality.smoothness, 0) / lastThird.length;
      const firstQuality = firstThird.reduce((sum, r) => sum + r.quality.smoothness, 0) / firstThird.length;

      if (lastQuality < firstQuality * 0.85) {
        consistency.fatigueDetected = true;
        consistency.recommendations.push('Form degradation detected - you may be fatiguing. Consider rest or reducing volume.');
      }
    }

    return consistency;
  }
}

const repProgressionService = new RepProgressionService();
export default repProgressionService;
