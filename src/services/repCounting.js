// Rep Counting Service - Detects and counts exercise repetitions

class RepCountingService {
  constructor() {
    this.repThresholds = {
      squat: { metric: 'hipHeight', fallbackMetric: 'kneeAngle', threshold: 0.08, direction: 'down' },
      deadlift: { metric: 'hipHeight', fallbackMetric: 'kneeAngle', threshold: 0.10, direction: 'down' },
      overhead_press: { metric: 'wristHeight', fallbackMetric: 'shoulderHeight', threshold: 0.12, direction: 'up' },
      bench_press: { metric: 'wristHeight', fallbackMetric: 'elbowHeight', threshold: 0.10, direction: 'down' },
      pull_up: { metric: 'shoulderHeight', fallbackMetric: 'chinHeight', threshold: 0.15, direction: 'up' }
    };
    this.debug = true; // Enable debug logging
  }

  /**
   * Count reps by detecting peaks and valleys in movement
   */
  countReps(frames, exerciseId) {
    if (this.debug) console.log(`[RepCounting] Starting rep count for ${exerciseId} with ${frames.length} frames`);
    
    if (frames.length < 5) {
      if (this.debug) console.log('[RepCounting] Not enough frames (need at least 5)');
      return { count: 0, repRanges: [], metricData: [] };
    }

    const config = this.repThresholds[exerciseId];
    if (!config) {
      if (this.debug) console.log(`[RepCounting] No config found for exercise: ${exerciseId}`);
      return { count: 0, repRanges: [], metricData: [] };
    }

    // Extract the relevant metric over time
    let metricData = this.extractMetric(frames, config.metric);
    
    // Check if we have valid data, otherwise try fallback
    const validDataPoints = metricData.filter(d => d.value !== null && d.value !== 0);
    if (validDataPoints.length < frames.length * 0.5 && config.fallbackMetric) {
      if (this.debug) console.log(`[RepCounting] Primary metric failed, trying fallback: ${config.fallbackMetric}`);
      metricData = this.extractMetric(frames, config.fallbackMetric);
    }
    
    if (this.debug) {
      const values = metricData.map(d => d.value).filter(v => v !== null);
      const min = Math.min(...values);
      const max = Math.max(...values);
      console.log(`[RepCounting] Metric range: min=${min.toFixed(3)}, max=${max.toFixed(3)}, range=${(max-min).toFixed(3)}`);
    }
    
    // Find peaks and valleys with adaptive threshold
    const values = metricData.map(d => d.value).filter(v => v !== null && v !== 0);
    const range = Math.max(...values) - Math.min(...values);
    const adaptiveThreshold = Math.max(config.threshold, range * 0.15); // At least 15% of range
    
    if (this.debug) console.log(`[RepCounting] Using threshold: ${adaptiveThreshold.toFixed(3)} (config: ${config.threshold}, range-based: ${(range * 0.15).toFixed(3)})`);
    
    const { peaks, valleys } = this.findPeaksAndValleys(metricData, adaptiveThreshold);
    
    if (this.debug) console.log(`[RepCounting] Found ${peaks.length} peaks and ${valleys.length} valleys`);
    
    // Count complete reps based on exercise direction
    const repRanges = this.identifyReps(peaks, valleys, config.direction, frames);
    
    if (this.debug) console.log(`[RepCounting] Identified ${repRanges.length} complete reps`);
    
    return {
      count: repRanges.length,
      repRanges,
      peakFrames: peaks,
      valleyFrames: valleys,
      metricData
    };
  }

  /**
   * Extract relevant metric from frames
   */
  extractMetric(frames, metricType) {
    return frames.map((frame, index) => {
      const landmarks = frame.landmarks;
      let value = null;

      if (!landmarks || landmarks.length < 33) {
        return { index, time: frame.time, value: null };
      }

      switch (metricType) {
        case 'hipHeight':
          if (landmarks[23]?.visibility > 0.3 && landmarks[24]?.visibility > 0.3) {
            value = (landmarks[23].y + landmarks[24].y) / 2;
          }
          break;
        
        case 'wristHeight':
          if (landmarks[15]?.visibility > 0.3 && landmarks[16]?.visibility > 0.3) {
            value = (landmarks[15].y + landmarks[16].y) / 2;
          }
          break;
        
        case 'shoulderHeight':
          if (landmarks[11]?.visibility > 0.3 && landmarks[12]?.visibility > 0.3) {
            value = (landmarks[11].y + landmarks[12].y) / 2;
          }
          break;
        
        case 'elbowHeight':
          if (landmarks[13]?.visibility > 0.3 && landmarks[14]?.visibility > 0.3) {
            value = (landmarks[13].y + landmarks[14].y) / 2;
          }
          break;
          
        case 'chinHeight':
          if (landmarks[0]?.visibility > 0.3) {
            value = landmarks[0].y;
          }
          break;
        
        case 'kneeAngle':
          // For squats, use knee angle as alternative - lower angle = deeper squat
          if (landmarks[23] && landmarks[25] && landmarks[27]) {
            const angle = this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
            // Normalize: 180 (standing) -> 1.0, 90 (deep squat) -> 0.5
            value = angle / 180;
          }
          break;
          
        default:
          value = null;
      }

      return { index, time: frame.time, value };
    });
  }
  
  /**
   * Calculate angle between three points
   */
  calculateAngle(a, b, c) {
    if (!a || !b || !c) return 180;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  /**
   * Find local maxima and minima
   */
  findPeaksAndValleys(data, minAmplitude = 0.1) {
    const peaks = [];
    const valleys = [];
    
    // Filter out null values and interpolate if needed
    const validData = data.filter(d => d.value !== null);
    if (validData.length < 5) {
      if (this.debug) console.log('[RepCounting] Not enough valid data points for peak detection');
      return { peaks: [], valleys: [] };
    }
    
    // Smooth the data first with larger window for noise reduction
    const smoothed = this.smoothData(validData.map(d => d.value), 5);
    
    for (let i = 2; i < smoothed.length - 2; i++) {
      const prev2 = smoothed[i - 2];
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      const next2 = smoothed[i + 2];
      
      // More robust peak detection - check wider neighborhood
      const isLocalMax = curr > prev && curr > next && curr >= prev2 && curr >= next2;
      const isLocalMin = curr < prev && curr < next && curr <= prev2 && curr <= next2;
      
      if (isLocalMax) {
        peaks.push({ index: validData[i].index, time: validData[i].time, value: curr });
      }
      
      if (isLocalMin) {
        valleys.push({ index: validData[i].index, time: validData[i].time, value: curr });
      }
    }
    
    if (this.debug) console.log(`[RepCounting] Raw peaks: ${peaks.length}, raw valleys: ${valleys.length}`);
    
    // Filter out small fluctuations
    return this.filterSignificantPoints(peaks, valleys, minAmplitude);
  }

  /**
   * Smooth data using moving average
   */
  smoothData(data, windowSize = 3) {
    const smoothed = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - halfWindow); j <= Math.min(data.length - 1, i + halfWindow); j++) {
        sum += data[j];
        count++;
      }
      
      smoothed.push(sum / count);
    }
    
    return smoothed;
  }

  /**
   * Filter out peaks/valleys that are too small
   */
  filterSignificantPoints(peaks, valleys, minAmplitude) {
    const allPoints = [...peaks, ...valleys].sort((a, b) => a.index - b.index);
    
    const filtered = [];
    let lastPoint = null;
    
    for (const point of allPoints) {
      if (!lastPoint) {
        filtered.push(point);
        lastPoint = point;
        continue;
      }
      
      // Check if amplitude is significant
      const amplitude = Math.abs(point.value - lastPoint.value);
      if (amplitude >= minAmplitude) {
        filtered.push(point);
        lastPoint = point;
      }
    }
    
    // Separate back into peaks and valleys
    const filteredPeaks = filtered.filter(p => peaks.some(pk => pk.index === p.index));
    const filteredValleys = filtered.filter(p => valleys.some(v => v.index === p.index));
    
    return { peaks: filteredPeaks, valleys: filteredValleys };
  }

  /**
   * Identify complete reps from peaks and valleys
   */
  identifyReps(peaks, valleys, direction, frames) {
    const repRanges = [];
    
    // Sort all points chronologically
    const allPoints = [...peaks, ...valleys].sort((a, b) => a.index - b.index);
    
    if (this.debug) console.log(`[RepCounting] Identifying reps from ${allPoints.length} points, direction: ${direction}`);
    
    if (allPoints.length < 3) {
      return repRanges;
    }
    
    // Create a map of frame index to frame for quick lookup
    const frameMap = new Map();
    frames.forEach((f, i) => frameMap.set(i, f));
    
    if (direction === 'down') {
      // Rep = start high, go low, return high (squat, deadlift)
      // In normalized Y coordinates: high position = lower Y value, low position = higher Y value
      for (let i = 0; i < allPoints.length - 2; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        const p3 = allPoints[i + 2];
        
        // Check if it's valley -> peak -> valley (in Y coords: low Y -> high Y -> low Y)
        // But wait - for "down" exercises like squat:
        // Standing = hips high in real world = LOW y value (top of screen)
        // Squatted = hips low in real world = HIGH y value (bottom of screen)
        // So a rep is: low Y (standing) -> high Y (squatted) -> low Y (standing)
        // That's actually valley -> peak -> valley in Y coordinates!
        
        const isValley1 = valleys.some(v => v.index === p1.index);
        const isPeak = peaks.some(p => p.index === p2.index);
        const isValley2 = valleys.some(v => v.index === p3.index);
        
        if (isValley1 && isPeak && isValley2) {
          const frame1 = frameMap.get(p1.index) || frames[0];
          const frame2 = frameMap.get(p2.index) || frames[0];
          const frame3 = frameMap.get(p3.index) || frames[0];
          
          repRanges.push({
            startIndex: p1.index,
            bottomIndex: p2.index,
            endIndex: p3.index,
            startTime: frame1.time,
            bottomTime: frame2.time,
            endTime: frame3.time,
            duration: frame3.time - frame1.time,
            rangeOfMotion: Math.abs(p1.value - p2.value)
          });
          
          if (this.debug) console.log(`[RepCounting] Found rep: frames ${p1.index}->${p2.index}->${p3.index}, duration: ${(frame3.time - frame1.time).toFixed(2)}s`);
        }
      }
    } else {
      // Rep = start low, go high, return low (overhead press, pull-up)
      // In normalized Y: low real = high Y, high real = low Y
      // So: high Y (start low) -> low Y (go high) -> high Y (return low)
      // That's: peak -> valley -> peak in Y coordinates
      for (let i = 0; i < allPoints.length - 2; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        const p3 = allPoints[i + 2];
        
        const isPeak1 = peaks.some(p => p.index === p1.index);
        const isValley = valleys.some(v => v.index === p2.index);
        const isPeak2 = peaks.some(p => p.index === p3.index);
        
        if (isPeak1 && isValley && isPeak2) {
          const frame1 = frameMap.get(p1.index) || frames[0];
          const frame2 = frameMap.get(p2.index) || frames[0];
          const frame3 = frameMap.get(p3.index) || frames[0];
          
          repRanges.push({
            startIndex: p1.index,
            topIndex: p2.index,
            endIndex: p3.index,
            startTime: frame1.time,
            topTime: frame2.time,
            endTime: frame3.time,
            duration: frame3.time - frame1.time,
            rangeOfMotion: Math.abs(p2.value - p1.value)
          });
          
          if (this.debug) console.log(`[RepCounting] Found rep: frames ${p1.index}->${p2.index}->${p3.index}, duration: ${(frame3.time - frame1.time).toFixed(2)}s`);
        }
      }
    }
    
    return repRanges;
  }

  /**
   * Analyze rep quality
   */
  analyzeRepQuality(repRanges) {
    if (repRanges.length === 0) {
      return {
        avgDuration: 0,
        avgROM: 0,
        consistency: 0,
        tempoScore: 0
      };
    }

    const durations = repRanges.map(r => r.duration);
    const roms = repRanges.map(r => r.rangeOfMotion);

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgROM = roms.reduce((a, b) => a + b, 0) / roms.length;

    // Calculate consistency (lower is better)
    const durationVariance = this.calculateVariance(durations);
    const romVariance = this.calculateVariance(roms);
    const consistency = 100 - Math.min(100, (durationVariance + romVariance) * 200);

    // Tempo score (ideal: 2-4 seconds per rep)
    const tempoScore = durations.map(d => {
      if (d >= 2 && d <= 4) return 100;
      if (d >= 1 && d <= 6) return 70;
      return 40;
    }).reduce((a, b) => a + b, 0) / durations.length;

    return {
      avgDuration,
      avgROM,
      consistency,
      tempoScore,
      details: repRanges.map((rep, i) => ({
        repNumber: i + 1,
        duration: rep.duration,
        rangeOfMotion: rep.rangeOfMotion
      }))
    };
  }

  /**
   * Calculate variance
   */
  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}

const repCountingService = new RepCountingService();
export default repCountingService;
