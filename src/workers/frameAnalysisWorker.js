/**
 * Web Worker for parallel frame analysis
 * Analyzes multiple frames in parallel to speed up video processing
 */
/* eslint-disable no-restricted-globals */

import poseAnalysisService from '../services/poseAnalysis';

/**
 * Analyze a batch of frames
 * Expects: { frames: [...], exerciseId }
 * Returns: { results: [...], errors: null } or { results: null, errors: message }
 */
// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event) => {
  try {
    const { frames, exerciseId, frameIndices } = event.data;
    const results = [];

    // MediaPipe Pose relies on `window` and usually can't run inside a Web Worker in this app.
    // If it can't initialize here, signal failure so the main thread can fall back.
    try {
      await poseAnalysisService.initialize();
    } catch (e) {
      self.postMessage({
        success: false,
        error: e?.message || 'Pose analysis unavailable in worker'
      });
      return;
    }

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const originalIndex = frameIndices[i];
      try {

        // Analyze pose from frame imageData
        const poseResults = await poseAnalysisService.analyzeFrame(frame.imageData);

        const poseLandmarks = poseResults?.poseLandmarks || null;
        const analysis = poseLandmarks
          ? (poseAnalysisService.analyzeExercise(exerciseId, poseLandmarks) || {})
          : {};

        const landmarksWithNames = poseLandmarks
          ? {
              leftShoulder: poseLandmarks[11],
              rightShoulder: poseLandmarks[12],
              leftHip: poseLandmarks[23],
              rightHip: poseLandmarks[24],
              leftKnee: poseLandmarks[25],
              rightKnee: poseLandmarks[26],
              leftAnkle: poseLandmarks[27],
              rightAnkle: poseLandmarks[28],
              leftElbow: poseLandmarks[13],
              rightElbow: poseLandmarks[14],
              leftWrist: poseLandmarks[15],
              rightWrist: poseLandmarks[16]
            }
          : {};

        const errors = poseLandmarks
          ? poseAnalysisService.validateForm(
              exerciseId,
              landmarksWithNames,
              analysis
            )
          : [];

        results.push({
          originalIndex,
          time: frame.time,
          landmarks: poseLandmarks,
          errors,
          analysis,
          dataUrl: frame.dataUrl,
          success: true
        });
      } catch (err) {
        console.warn(`Frame analysis error in worker:`, err);
        results.push({
          originalIndex,
          time: frame?.time,
          landmarks: null,
          errors: [],
          analysis: {},
          dataUrl: frame?.dataUrl,
          success: true
        });
      }
    }

    // Send results back to main thread
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ results, success: true });
  } catch (error) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ success: false, error: error.message });
  }
};
