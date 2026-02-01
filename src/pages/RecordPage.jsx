import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Input,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  useToast,
  List,
  ListItem,
  ListIcon,
  Flex,
  Icon,
  Progress,
  AspectRatio,
  Switch,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure
} from '@chakra-ui/react';
import { FaCamera, FaUpload, FaPlay, FaStop, FaTimes, FaCheckCircle, FaInfoCircle, FaEye, FaEyeSlash, FaTrash } from 'react-icons/fa';
import { getExerciseById } from '../config/exercises';
import poseAnalysisService from '../services/poseAnalysis';
import repCountingService from '../services/repCounting';
import repProgressionService from '../services/repProgression';
import adaptiveAnalysisService from '../services/adaptiveAnalysis';
import storageService from '../services/storage';
import { extractFramesFromVideo, getVideoMetadata } from '../utils/videoProcessing';

const RecordPage = () => {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [exercise, setExercise] = useState(null);
  const [mode, setMode] = useState('setup'); // setup, camera, recording, analyzing
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [exerciseStats, setExerciseStats] = useState(null);
  const [detectedReps, setDetectedReps] = useState(null);
  const [showVisualization, setShowVisualization] = useState(true);
  const [currentAnalysisFrame, setCurrentAnalysisFrame] = useState(null);
  const [cameraAngleWarning, setCameraAngleWarning] = useState(null);
  const [liveErrors, setLiveErrors] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  
  const { isOpen: isStorageDialogOpen, onOpen: onStorageDialogOpen, onClose: onStorageDialogClose } = useDisclosure();
  const cancelRef = useRef();

  const videoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const previewVideoRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const analyzedFramesRef = useRef([]);
  const liveFramesRef = useRef([]);
  const frameCounterRef = useRef(0);

  useEffect(() => {
    const ex = getExerciseById(exerciseId);
    if (!ex) {
      toast({
        title: 'Exercise not found',
        status: 'error',
        duration: 3000
      });
      navigate('/');
      return;
    }
    setExercise(ex);

    // Load exercise stats for tips
    const stats = storageService.getExerciseStats(exerciseId);
    setExerciseStats(stats);

    // Initialize MediaPipe
    poseAnalysisService.initialize().catch(err => {
      console.error('Failed to initialize pose analysis:', err);
    });

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [exerciseId, navigate, toast]);

  // Ensure video keeps playing during recording
  useEffect(() => {
    if (isRecording && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.error('Error playing video during recording:', err);
      });
    }
  }, [isRecording]);

  // Redraw skeleton when analysis frame changes
  useEffect(() => {
    if (currentAnalysisFrame && analysisCanvasRef.current && showVisualization) {
      const canvas = analysisCanvasRef.current;
      canvas.width = currentAnalysisFrame.width || 640;
      canvas.height = currentAnalysisFrame.height || 480;
      
      // Draw immediately - no delay needed
      poseAnalysisService.drawSkeleton(
        canvas, 
        currentAnalysisFrame.landmarks, 
        currentAnalysisFrame.errors
      );
    }
  }, [currentAnalysisFrame, showVisualization]);

  // Detect camera angle issues (informational only, doesn't block recording)
  const checkCameraAngle = async (video) => {
    try {
      // Create temp canvas to capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // Quick pose analysis to check visibility
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const results = await poseAnalysisService.analyzeFrame(imageData);
      
      if (!results || !results.poseLandmarks) {
        // Person not visible at this moment - just warn, don't block
        setCameraAngleWarning('⚠️ No person detected right now. Make sure you are in frame before recording.');
        return;
      }
      
      const landmarks = results.poseLandmarks;
      
      // Check key landmark visibility
      const criticalLandmarks = [11, 12, 23, 24, 25, 26]; // Shoulders, hips, knees
      const visibleLandmarks = criticalLandmarks.filter(idx => 
        landmarks[idx] && landmarks[idx].visibility > 0.5
      );
      
      if (visibleLandmarks.length < 4) {
        // Poor angle - warn but allow recording since person might adjust
        setCameraAngleWarning('⚠️ Camera angle looks off. Try to show your full body from head to feet.');
        return;
      }
      
      // Check if person is too close or far
      const hipWidth = Math.abs(landmarks[23].x - landmarks[24].x);
      if (hipWidth < 0.1) {
        setCameraAngleWarning('⚠️ You are very close to the camera. Try standing further away.');
        return;
      }
      if (hipWidth > 0.5) {
        setCameraAngleWarning('⚠️ You are far from the camera. Try standing closer.');
        return;
      }
      
      // All checks passed
      setCameraAngleWarning(null);
    } catch (err) {
      console.error('Camera angle check error:', err);
      // Don't warn on error, let user proceed
      setCameraAngleWarning(null);
    }
  };

  const startCamera = async () => {
    try {
      // Set mode first so video element is rendered
      setMode('camera');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      // Wait for React to render video element (use requestAnimationFrame for better sync)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Wait for video to be ready and playing
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
            });
          };
          
          // Check camera angle once video is actually playing
          videoRef.current.onplaying = () => {
            // Check on next frame after playback starts
            requestAnimationFrame(() => {
              checkCameraAngle(videoRef.current);
            });
          };
        }
      });
    } catch (err) {
      console.error('Camera error:', err);
      toast({
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions to record video.',
        status: 'error',
        duration: 5000
      });
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    // Clear live frame buffer
    liveFramesRef.current = [];
    
    // Start live skeleton analysis (throttled to ~5fps for performance)
    const livePoseInterval = setInterval(async () => {
      // Check refs directly instead of state (state is async)
      if (!videoRef.current || !liveCanvasRef.current || !mediaRecorderRef.current) {
        return;
      }
      
      try {
        const canvas = liveCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        
        // Match canvas size
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }
        
        // Clear canvas for transparent overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Create temporary canvas to capture video frame for analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        
        // Analyze pose from temp canvas
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const results = await poseAnalysisService.analyzeFrame(imageData);
        
        if (results && results.poseLandmarks) {
          const analysis = poseAnalysisService.analyzeExercise(exercise.id, results.poseLandmarks);
          
          if (analysis) {
            // Create a landmarks object with both raw landmarks and named landmarks
            const landmarksWithNames = {
              leftShoulder: results.poseLandmarks[11],
              rightShoulder: results.poseLandmarks[12],
              leftHip: results.poseLandmarks[23],
              rightHip: results.poseLandmarks[24],
              leftKnee: results.poseLandmarks[25],
              rightKnee: results.poseLandmarks[26],
              leftAnkle: results.poseLandmarks[27],
              rightAnkle: results.poseLandmarks[28],
              leftElbow: results.poseLandmarks[13],
              rightElbow: results.poseLandmarks[14],
              leftWrist: results.poseLandmarks[15],
              rightWrist: results.poseLandmarks[16]
            };
            
            const errors = poseAnalysisService.validateForm(exercise, landmarksWithNames, analysis);
            setLiveErrors(errors);
            
            // Store frame for later use
            liveFramesRef.current.push({
              time: Date.now(),
              landmarks: results.poseLandmarks,
              errors
            });
            
            // Draw skeleton overlay on main canvas (mirrored to match video)
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            poseAnalysisService.drawSkeleton(canvas, results.poseLandmarks, errors);
            ctx.restore();
          }
        }
      } catch (err) {
        // Silently handle live analysis errors
        console.debug('Live pose error:', err);
      }
    }, 200); // 5fps sampling
    
    // Store interval for cleanup
    frameCounterRef.current = livePoseInterval;

    chunksRef.current = [];
    
    // Try different mime types for broader compatibility
    let mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: mimeType
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Clear live analysis interval
      if (frameCounterRef.current) {
        clearInterval(frameCounterRef.current);
      }
      
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setMode('setup');
      stopCamera();
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  // Fallback analysis function for when Web Workers fail
  const analyzeFramesFallback = async (frameBatch, startIndex) => {
    const results = [];
    for (let i = 0; i < frameBatch.length; i++) {
      const { index: originalIndex, frame } = frameBatch[i];
      try {
        const poseResults = await poseAnalysisService.analyzeFrame(frame.imageData);
        const poseLandmarks = poseResults?.poseLandmarks || null;

        const analysis = poseLandmarks
          ? (poseAnalysisService.analyzeExercise(exercise.id, poseLandmarks) || {})
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
              exercise,
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
        console.warn(`Fallback analysis failed for frame ${originalIndex}:`, err);
        results.push({
          originalIndex,
          time: frame.time,
          landmarks: null,
          errors: [],
          analysis: {},
          dataUrl: frame.dataUrl,
          success: true
        });
      }
    }
    return results;
  };

  const analyzeVideo = async () => {
    if (!videoUrl || !exercise) return;

    setMode('analyzing');
    setAnalysisProgress(0);
    setCurrentAnalysisFrame(null);
    analyzedFramesRef.current = [];

    try {
      // Get video duration first (fast - metadata only)
      const { duration } = await getVideoMetadata(videoUrl);
      setAnalysisProgress(5);
      
      // Calculate optimal frame interval based on duration
      let frameInterval;
      if (duration <= 3) {
        frameInterval = 0.05;   // 20 fps for very short videos
      } else if (duration <= 5) {
        frameInterval = 0.067;  // 15 fps
      } else if (duration <= 10) {
        frameInterval = 0.083;  // 12 fps
      } else if (duration <= 20) {
        frameInterval = 0.1;    // 10 fps
      } else if (duration <= 30) {
        frameInterval = 0.133;  // ~7.5 fps
      } else {
        frameInterval = 0.167;  // ~6 fps
      }

      // Cap total frames to keep analysis fast
      const maxFrames = 180;
      const minIntervalForCap = duration / maxFrames;
      frameInterval = Math.max(frameInterval, minIntervalForCap);
      
      // Extract frames with optimal interval (single extraction)
      const { frames: extractedFrames } = await extractFramesFromVideo(videoUrl, frameInterval);
      setAnalysisProgress(15);
      
      console.log(`Video: ${duration.toFixed(1)}s, ${extractedFrames.length} frames at ${(1/frameInterval).toFixed(1)} fps`);
      
      const frameResults = [];
      const issueFrames = {};

      // Single-pass analysis: send all extracted frames to workers (no pre-scan)
      setAnalysisProgress(20);
      const framesWithLandmarks = extractedFrames.map((frame, index) => ({
        index,
        frame
      }));

      setAnalysisProgress(25);
      
      // SECOND PASS: Analyze frames with multithreading (Web Workers)
      const totalFrames = framesWithLandmarks.length;
      console.log('Second pass: Analyzing frames with Web Workers...');
      
      // Determine number of workers (max 4 to avoid overwhelming system)
      const workerCount = Math.min(4, Math.ceil(totalFrames / 50));
      const frameBatchSize = Math.ceil(totalFrames / workerCount);
      
      console.log(`Using ${workerCount} workers, ${frameBatchSize} frames per batch`);
      
      // Create workers and analyze frame batches in parallel
      const analyzeFramesBatch = async (batch, batchIndex) => {
        return new Promise((resolve, reject) => {
          try {
            const worker = new Worker(
              new URL('../workers/frameAnalysisWorker.js', import.meta.url),
              { type: 'module' }
            );
            
            // Prepare batch data (remove large imageData for transfer)
            const batchData = batch.map(f => ({
              imageData: f.frame.imageData,
              time: f.frame.time,
              dataUrl: f.frame.dataUrl
            }));
            
            const batchIndices = batch.map((_, i) => batchIndex * frameBatchSize + i);
            
            worker.onmessage = (event) => {
              worker.terminate();
              if (event.data.success) {
                resolve(event.data.results);
              } else {
                reject(new Error(event.data.error));
              }
            };
            
            worker.onerror = (err) => {
              worker.terminate();
              reject(err);
            };
            
            // Send batch to worker
            worker.postMessage({
              frames: batchData,
              exerciseId: exercise.id,
              frameIndices: batchIndices
            });
          } catch (err) {
            reject(err);
          }
        });
      };
      
      // Process batches in parallel
      const batches = [];
      for (let i = 0; i < framesWithLandmarks.length; i += frameBatchSize) {
        batches.push(framesWithLandmarks.slice(i, i + frameBatchSize));
      }
      
      // Analyze all batches in parallel and collect results
      const batchResults = await Promise.all(
        batches.map((batch, idx) => 
          analyzeFramesBatch(batch, idx)
            .then(results => {
              // Update progress
              const batchProgress = (idx + 1) / batches.length;
              setAnalysisProgress(25 + Math.round(batchProgress * 35));
              return results;
            })
            .catch(err => {
              console.warn(`Batch ${idx} analysis failed, falling back to single-threaded:`, err);
              // Fallback: analyze batch sequentially if worker fails
              return analyzeFramesFallback(batches[idx], idx * frameBatchSize);
            })
        )
      );
      
      // Flatten all results
      const allResults = batchResults.flat();
      
      // Process results to extract frames and issues
      for (const result of allResults) {
        if (result.success) {
          frameResults.push({
            time: result.time,
            frameIndex: result.originalIndex,
            errors: result.errors,
            landmarks: result.landmarks,
            dataUrl: result.dataUrl,
            ...result.analysis
          });
          
          // Track issue frames
          result.errors.forEach(error => {
            if (!issueFrames[error.id]) {
              issueFrames[error.id] = [];
            }
            issueFrames[error.id].push({
              frameIndex: result.originalIndex,
              dataUrl: result.dataUrl,
              landmarks: result.landmarks,
              error
            });
          });
          
          // Store for playback
          analyzedFramesRef.current[result.originalIndex] = {
            time: result.time,
            dataUrl: result.dataUrl,
            landmarks: result.landmarks,
            errors: result.errors
          };
          
          // Update visualization occasionally
          if (showVisualization && frameResults.length % 15 === 0) {
            setCurrentAnalysisFrame({
              dataUrl: result.dataUrl,
              landmarks: result.landmarks,
              errors: result.errors,
              frameNumber: frameResults.length,
              totalFrames: totalFrames,
              width: 640,
              height: 480
            });
          }
        }
      }

      // If no frames were successfully analyzed, continue with empty results
      // (avoid hard failure; allow a minimal workout record)
      if (frameResults.length === 0) {
        toast({
          title: 'No Analysis Frames',
          description: 'No usable frames were produced. Results will be limited.',
          status: 'warning',
          duration: 6000,
          isClosable: true
        });
      }
      
      // All frames analyzed - frameResults now contains only valid frames
      const validFrameResults = frameResults;

      setAnalysisProgress(65);

      // ADAPTIVE ANALYSIS - Generate guidance (no limited-analysis warnings)
      const adaptiveReport = adaptiveAnalysisService.generateAdaptiveReport(
        exercise.id,
        validFrameResults,
        {}
      );

      setAnalysisProgress(70);

      // REP COUNTING - Detect and count reps
      const repAnalysis = repCountingService.countReps(validFrameResults, exercise.id);
      setDetectedReps(repAnalysis);

      // Auto-fill reps if not manually entered
      if (!reps && repAnalysis.count > 0) {
        setReps(repAnalysis.count.toString());
      }

      // Show rep count detection
      if (repAnalysis.count > 0) {
        toast({
          title: 'Reps Detected',
          description: `Found ${repAnalysis.count} rep${repAnalysis.count !== 1 ? 's' : ''}`,
          status: 'info',
          duration: 4000,
          isClosable: true
        });
      }
      
      // Extract sample frames for each issue (showing progression of form breakdown)
      const issueSamples = {};
      Object.entries(issueFrames).forEach(([issueId, frames]) => {
        if (frames.length > 0) {
          // Group consecutive frames to find form breakdown sequences
          const sequences = [];
          let currentSequence = [frames[0]];
          
          for (let i = 1; i < frames.length; i++) {
            const prevFrame = frames[i - 1];
            const currFrame = frames[i];
            
            // If frames are consecutive (within 2 frame indices), continue sequence
            if (currFrame.frameIndex - prevFrame.frameIndex <= 2) {
              currentSequence.push(currFrame);
            } else {
              // Start new sequence
              if (currentSequence.length > 0) {
                sequences.push(currentSequence);
              }
              currentSequence = [currFrame];
            }
          }
          
          if (currentSequence.length > 0) {
            sequences.push(currentSequence);
          }
          
          // Take the longest sequence (most dramatic form breakdown)
          // or the last sequence if all are similar
          const selectedSequence = sequences.length > 0 ? 
            sequences.reduce((a, b) => a.length >= b.length ? a : b) : 
            frames;
          
          // Sample frames proportionally across the sequence
          const sampleCount = Math.min(3, selectedSequence.length);
          const sampledFrames = [];
          
          for (let i = 0; i < sampleCount; i++) {
            const index = Math.floor((i / (sampleCount - 1 || 1)) * (selectedSequence.length - 1));
            sampledFrames.push(selectedSequence[index]);
          }
          
          issueSamples[issueId] = sampledFrames.map(f => ({
            dataUrl: f.dataUrl,
            landmarks: f.landmarks,
            error: f.error
          }));
        }
      });

      setAnalysisProgress(75);

      // ERROR AGGREGATION - Collect all errors across frames
      let significantErrors = [];
      if (validFrameResults.length > 0) {
        const errorCounts = {};
        validFrameResults.forEach(frame => {
          if (frame && frame.errors) {
            frame.errors.forEach(error => {
              if (!errorCounts[error.id]) {
                errorCounts[error.id] = { ...error, count: 0, frames: [] };
              }
              errorCounts[error.id].count++;
              errorCounts[error.id].frames.push(frame.time);
            });
          }
        });

        // Filter errors based on severity-adjusted thresholds
        // This prevents fluctuation from frame sampling variations
        significantErrors = Object.values(errorCounts)
          .map(err => ({
            ...err,
            frequency: err.count / validFrameResults.length,
            // Determine threshold based on severity - critical errors require less frequency
            thresholdFrequency: 
              err.severity === 'critical' ? 0.15 : // 15% for critical (very important)
              err.severity === 'high' ? 0.20 :      // 20% for high
              err.severity === 'medium' ? 0.25 :    // 25% for medium
              0.30                                   // 30% for low
          }))
          .filter(err => err.frequency >= err.thresholdFrequency)
          .sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
          });
      }

      // SCORING - Adjust based on analysis completeness
      let baseScore = 0;
      if (validFrameResults.length > 0) {
        baseScore = Math.max(0, Math.min(100, 100 - (significantErrors.length * 15)));
      }
      const completenessMultiplier = adaptiveReport.confidence;
      const score = Math.round(baseScore * completenessMultiplier);

      setAnalysisProgress(90);

      // REP PROGRESSION ANALYSIS - Analyze movement quality through each phase
      let repProgressionAnalyses = [];
      if (repAnalysis.repRanges && repAnalysis.repRanges.length > 0) {
        repProgressionAnalyses = repAnalysis.repRanges.map(repRange => {
          const repFrames = validFrameResults.slice(repRange.startFrame, repRange.endFrame + 1);
          return repProgressionService.analyzeRepProgression(repFrames, exercise.id);
        }).filter(Boolean);
      }

      // Get consistency analysis across reps
      const repConsistency = repProgressionAnalyses.length > 1 ? 
        repProgressionService.compareRepProgression(repProgressionAnalyses) : null;

      // Analyze rep quality
      const repQuality = repAnalysis.count > 0 ? 
        repCountingService.analyzeRepQuality(repAnalysis.repRanges) : null;

      const workout = {
        exerciseId: exercise.id,
        weight: parseFloat(weight) || 0,
        reps: repAnalysis.count || parseInt(reps) || 0,
        detectedReps: repAnalysis.count,
        userEnteredReps: parseInt(reps) || 0,
        score,
        baseScore,
        errors: significantErrors,
        frameCount: frameResults.length,
        videoUrl: null,
        adaptiveAnalysis: {
          mode: adaptiveReport.analysisMode,
          confidence: adaptiveReport.confidence,
          completenessScore: adaptiveReport.completenessScore,
          cameraAngle: adaptiveReport.camera?.currentAngle,
          missingLandmarks: adaptiveReport.landmarks.missing,
          availableChecks: adaptiveReport.checks.available,
          unavailableChecks: adaptiveReport.checks.unavailable
        },
        repAnalysis: repQuality ? {
          avgDuration: repQuality.avgDuration,
          consistency: repQuality.consistency,
          tempoScore: repQuality.tempoScore
        } : null,
        repProgressionAnalyses,
        repConsistency,
        repRanges: repAnalysis.repRanges || [],
        issueSamples
      };

      setAnalysisProgress(95);

      // Save workout metadata first
      const savedWorkout = storageService.saveWorkout(workout);
      storageService.updateExerciseStats(exercise.id, workout);

      // Store frame data for playback (landmarks, errors, metrics) with dataUrls for overlay
      try {
        const frameData = analyzedFramesRef.current.filter(Boolean).map(frame => ({
          time: frame.time,
          landmarks: frame.landmarks,
          errors: frame.errors || [],
          dataUrl: frame.dataUrl
        }));
        
        await storageService.saveWorkoutFrameData(savedWorkout.id, frameData);
        console.log(`Stored frame data for ${frameData.length} frames`);
      } catch (err) {
        console.warn('Could not store frame data:', err);
      }

      // Store video blob for playback
      try {
        const videoBlob = await (await fetch(videoUrl)).blob();
        await storageService.saveVideoBlob(savedWorkout.id, videoBlob);
        console.log(`Stored video blob (${(videoBlob.size / 1024 / 1024).toFixed(2)}MB)`);
      } catch (err) {
        console.warn('Could not store video blob:', err);
      }

      // Store detailed analysis including issue samples
      try {
        await storageService.saveAnalysisData(savedWorkout.id, {
          adaptiveAnalysis: workout.adaptiveAnalysis,
          repAnalysis: workout.repAnalysis,
          repProgressionAnalyses,
          repConsistency,
          issueSamples
        });
        console.log('Stored analysis data');
      } catch (err) {
        console.warn('Could not store analysis data:', err);
      }

      setAnalysisProgress(100);

      // Pass data to results page
      navigate(`/results`, { 
        state: { 
          workout,
          exerciseData: {
            id: exercise.id,
            name: exercise.name,
            icon: exercise.icon,
            description: exercise.description,
            formTips: exercise.formTips,
            category: exercise.category
          },
          adaptiveReport,
          repAnalysis,
          repProgressionAnalyses,
          repConsistency
        } 
      });

    } catch (error) {
      console.error('Analysis error:', error);
      
      // Check if it's a quota error
      const isQuota = error.message?.includes('quota') || 
              error.message?.includes('Quota') ||
              error.message?.includes('QUOTA_EXCEEDED') ||
              error.name === 'QuotaExceededError';

      const isNoFrames = error.message?.includes('No valid analysis frames');
      
      if (isQuota) {
        // Get storage info and show dialog
        const estimate = await storageService.getStorageEstimate();
        const workoutCount = await storageService.getStoredWorkoutCount();
        setStorageInfo({
          usedMB: (estimate.used / 1024 / 1024).toFixed(1),
          quotaMB: (estimate.quota / 1024 / 1024).toFixed(0),
          percentUsed: estimate.percentUsed.toFixed(1),
          workoutCount
        });
        onStorageDialogOpen();
      } else {
        toast({
          title: isNoFrames ? 'No Analysis Frames' : 'Analysis Failed',
          description: isNoFrames
            ? 'No usable frames were produced. Try a clearer video with your full body visible.'
            : (error.message || 'An error occurred during analysis'),
          status: 'error',
          duration: 6000
        });
      }
      setMode('setup');
    }
  };

  const handleClearOldWorkouts = async () => {
    try {
      const deleted = await storageService.deleteOldestWorkoutData(3);
      toast({
        title: 'Storage Cleared',
        description: `Removed data from ${deleted} old workouts. You can try again now.`,
        status: 'success',
        duration: 4000
      });
      onStorageDialogClose();
    } catch (err) {
      toast({
        title: 'Failed to clear storage',
        description: err.message,
        status: 'error',
        duration: 4000
      });
    }
  };

  const handleClearAllStorage = async () => {
    try {
      await storageService.clearAllIndexedDBData();
      toast({
        title: 'Storage Cleared',
        description: 'All video and frame data has been cleared. Workout history is preserved.',
        status: 'success',
        duration: 4000
      });
      onStorageDialogClose();
    } catch (err) {
      toast({
        title: 'Failed to clear storage',
        description: err.message,
        status: 'error',
        duration: 4000
      });
    }
  };

  const resetRecording = () => {
    stopCamera();
    setVideoUrl(null);
    setMode('setup');
    setIsRecording(false);
  };

  if (!exercise) return null;

  return (
    <Container maxW="container.lg" py={8}>
      {/* Storage Quota Error Dialog */}
      <AlertDialog
        isOpen={isStorageDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={onStorageDialogClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" borderColor="gray.600">
            <AlertDialogHeader fontSize="lg" fontWeight="bold" color="white">
              <Icon as={FaTrash} mr={2} color="orange.400" />
              Storage Full
            </AlertDialogHeader>

            <AlertDialogBody color="gray.300">
              <VStack spacing={4} align="stretch">
                <Text>
                  Your browser storage is full. This happens when you have many saved workout recordings.
                </Text>
                
                {storageInfo && (
                  <Box bg="gray.700" p={3} borderRadius="md">
                    <Text fontSize="sm" color="gray.400">Storage Usage:</Text>
                    <Text fontWeight="bold">{storageInfo.usedMB} MB / {storageInfo.quotaMB} MB ({storageInfo.percentUsed}%)</Text>
                    <Text fontSize="sm" color="gray.400" mt={2}>Stored Workouts: {storageInfo.workoutCount}</Text>
                  </Box>
                )}
                
                <Text fontSize="sm">
                  You can clear old workout data to free up space. Your workout history (scores, dates) will be preserved.
                </Text>
              </VStack>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onStorageDialogClose} variant="ghost">
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={handleClearOldWorkouts} ml={3}>
                Clear Oldest 3
              </Button>
              <Button colorScheme="red" onClick={handleClearAllStorage} ml={3}>
                Clear All Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Box>
            <Heading size="xl" color="white" mb={2}>
              <Text as="span" fontSize="3xl" mr={3}>
                {exercise.icon}
              </Text>
              {exercise.name}
            </Heading>
            <Text color="gray.400">{exercise.description}</Text>
          </Box>
          <Button
            leftIcon={<FaTimes />}
            variant="ghost"
            onClick={() => navigate('/')}
          >
            Cancel
          </Button>
        </Flex>

        {/* Tips & Common Mistakes - Only in setup mode */}
        {mode === 'setup' && !videoUrl && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader>
              <Heading size="md" color="white">
                <Icon as={FaInfoCircle} color="blue.400" mr={2} />
                Form Tips & Reminders
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" color="green.400" mb={2}>
                    Key Points:
                  </Text>
                  <List spacing={2}>
                    {exercise.formTips.map((tip, i) => (
                      <ListItem key={i} color="gray.300" fontSize="sm">
                        <ListIcon as={FaCheckCircle} color="green.400" />
                        {tip}
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {exerciseStats && exerciseStats.totalSessions > 0 && (
                  <Box>
                    <Text fontWeight="bold" color="orange.400" mb={2}>
                      Your Common Mistakes:
                    </Text>
                    <List spacing={2}>
                      {Object.values(exerciseStats.commonErrors || {})
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3)
                        .map((error, i) => (
                          <ListItem key={i} color="gray.300" fontSize="sm">
                            <ListIcon as={FaInfoCircle} color="orange.400" />
                            {error.name} - {error.correction}
                          </ListItem>
                        ))}
                    </List>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Weight & Reps Input */}
        {mode === 'setup' && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader>
              <Heading size="sm" color="white">
                Workout Details (Optional)
              </Heading>
            </CardHeader>
            <CardBody>
              <HStack spacing={4}>
                <FormControl>
                  <FormLabel color="gray.400">Weight (lbs/kg)</FormLabel>
                  <NumberInput value={weight} onChange={setWeight} min={0}>
                    <NumberInputField
                      placeholder="Enter weight"
                      bg="gray.900"
                      borderColor="gray.600"
                      color="white"
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'red.500' }}
                    />
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel color="gray.400">
                    Reps
                    {detectedReps && detectedReps.count > 0 && (
                      <Badge ml={2} colorScheme="green" fontSize="xs">
                        {detectedReps.count} detected
                      </Badge>
                    )}
                  </FormLabel>
                  <NumberInput value={reps} onChange={setReps} min={0}>
                    <NumberInputField
                      placeholder={detectedReps?.count > 0 ? `Detected: ${detectedReps.count}` : "Auto-detected or enter manually"}
                      bg="gray.900"
                      borderColor="gray.600"
                      color="white"
                      _hover={{ borderColor: 'gray.500' }}
                      _focus={{ borderColor: 'red.500' }}
                    />
                  </NumberInput>
                </FormControl>
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Video Recording/Upload */}
        <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            {/* Initial Setup - Choose Record or Upload */}
            {mode === 'setup' && !videoUrl && (
              <VStack spacing={4}>
                <Button
                  leftIcon={<FaCamera />}
                  colorScheme="red"
                  size="lg"
                  w="full"
                  onClick={startCamera}
                  height="60px"
                >
                  Record with Camera
                </Button>

                <Text color="gray.500" fontWeight="bold">or</Text>

                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  display="none"
                />
                <Button
                  leftIcon={<FaUpload />}
                  colorScheme="orange"
                  size="lg"
                  w="full"
                  onClick={() => fileInputRef.current?.click()}
                  height="60px"
                >
                  Upload Video
                </Button>
              </VStack>
            )}

            {/* Camera Preview - Before Recording */}
            {/* Camera Mode - Single video element for both preview and recording */}
            {mode === 'camera' && (
              <VStack spacing={4}>
                {cameraAngleWarning && !isRecording && (
                  <Box bg="yellow.900" p={3} borderRadius="md" borderLeft="4px" borderColor="yellow.500" w="full">
                    <Text color="yellow.100" fontSize="sm">
                      <Icon as={FaInfoCircle} mr={2} />
                      {cameraAngleWarning}
                    </Text>
                  </Box>
                )}
                
                <AspectRatio ratio={16/9} w="full">
                  <Box
                    bg="black"
                    borderRadius="md"
                    overflow="hidden"
                    position="relative"
                  >
                    {/* Single video element - stays mounted throughout camera mode */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}
                    />
                    
                    {/* Canvas overlay for skeleton - only shown when recording */}
                    {isRecording && (
                      <canvas
                        ref={liveCanvasRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                    
                    {/* Recording badge */}
                    {isRecording && (
                      <Badge
                        position="absolute"
                        top={4}
                        left={4}
                        colorScheme="red"
                        fontSize="md"
                        zIndex={10}
                      >
                        ● RECORDING
                      </Badge>
                    )}
                    
                    {/* Live errors display - only when recording */}
                    {isRecording && liveErrors.length > 0 && (
                      <Box
                        position="absolute"
                        bottom={4}
                        left={4}
                        right={4}
                        bg="rgba(0,0,0,0.7)"
                        p={2}
                        borderRadius="md"
                        borderLeft="4px"
                        borderColor="red.500"
                      >
                        <Text color="red.300" fontSize="xs" fontWeight="bold">
                          Form Issues Detected:
                        </Text>
                        {liveErrors.slice(0, 2).map((err, i) => (
                          <Text key={i} color="red.200" fontSize="xs">
                            • {err.name}
                          </Text>
                        ))}
                      </Box>
                    )}
                  </Box>
                </AspectRatio>

                {/* Buttons change based on recording state */}
                {!isRecording ? (
                  <HStack spacing={4} w="full">
                    <Button
                      leftIcon={<FaPlay />}
                      colorScheme="red"
                      size="lg"
                      flex={1}
                      onClick={startRecording}
                    >
                      Start Recording
                    </Button>
                    <Button
                      leftIcon={<FaTimes />}
                      variant="outline"
                      size="lg"
                      onClick={resetRecording}
                    >
                      Cancel
                    </Button>
                  </HStack>
                ) : (
                  <Button
                    leftIcon={<FaStop />}
                    colorScheme="orange"
                    size="lg"
                    w="full"
                    onClick={stopRecording}
                  >
                    Stop Recording
                  </Button>
                )}
              </VStack>
            )}

            {/* Video Preview - After Recording/Upload */}
            {videoUrl && mode === 'setup' && (
              <VStack spacing={4}>
                <AspectRatio ratio={16/9} w="full">
                  <Box bg="black" borderRadius="md" overflow="hidden">
                    <video
                      ref={previewVideoRef}
                      src={videoUrl}
                      controls
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                </AspectRatio>

                <HStack spacing={4} w="full">
                  <Button
                    colorScheme="green"
                    size="lg"
                    flex={1}
                    onClick={analyzeVideo}
                  >
                    Analyze Form
                  </Button>
                  <Button
                    leftIcon={<FaTimes />}
                    variant="outline"
                    size="lg"
                    onClick={resetRecording}
                  >
                    Re-record
                  </Button>
                </HStack>
              </VStack>
            )}

            {/* Analyzing */}
            {mode === 'analyzing' && (
              <VStack spacing={4} py={4}>
                <Heading size="md" color="white">
                  Analyzing Your Form...
                </Heading>
                
                {/* Visualization Toggle */}
                <HStack justify="center" spacing={3}>
                  <Icon as={showVisualization ? FaEye : FaEyeSlash} color="gray.400" />
                  <Text color="gray.400" fontSize="sm">Show Analysis</Text>
                  <Switch
                    isChecked={showVisualization}
                    onChange={(e) => setShowVisualization(e.target.checked)}
                    colorScheme="green"
                    size="md"
                  />
                </HStack>

                {/* Video with Skeleton Overlay */}
                {showVisualization && (
                  <AspectRatio ratio={16/9} w="full" maxW="600px">
                    <Box
                      bg="gray.900"
                      borderRadius="md"
                      overflow="hidden"
                      position="relative"
                    >
                      {currentAnalysisFrame ? (
                        <>
                          {/* Display the current frame being analyzed */}
                          <Box
                            as="img"
                            src={currentAnalysisFrame.dataUrl}
                            alt="Analysis frame"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                            onLoad={(e) => {
                              // Set canvas size to match frame dimensions
                              if (analysisCanvasRef.current) {
                                analysisCanvasRef.current.width = currentAnalysisFrame.width || 640;
                                analysisCanvasRef.current.height = currentAnalysisFrame.height || 480;
                                poseAnalysisService.drawSkeleton(analysisCanvasRef.current, currentAnalysisFrame.landmarks, currentAnalysisFrame.errors);
                              }
                            }}
                          />
                          {/* Canvas for skeleton overlay */}
                          <canvas
                            ref={analysisCanvasRef}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              pointerEvents: 'none'
                            }}
                          />
                          {/* Frame counter badge */}
                          <Badge
                            position="absolute"
                            top={2}
                            right={2}
                            colorScheme="blue"
                            fontSize="sm"
                            px={2}
                            py={1}
                          >
                            Frame {currentAnalysisFrame.frameNumber}/{currentAnalysisFrame.totalFrames}
                          </Badge>
                          {/* Error indicator */}
                          {currentAnalysisFrame.errors.length > 0 && (
                            <Badge
                              position="absolute"
                              top={2}
                              left={2}
                              colorScheme="red"
                              fontSize="sm"
                              px={2}
                              py={1}
                            >
                              {currentAnalysisFrame.errors.length} issue{currentAnalysisFrame.errors.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </>
                      ) : (
                        /* Placeholder while loading frames */
                        <VStack justify="center" align="center" h="full" w="full" position="absolute">
                          <Text color="gray.500" fontSize="sm">Loading video frames...</Text>
                        </VStack>
                      )}
                    </Box>
                  </AspectRatio>
                )}

                <Progress
                  value={analysisProgress}
                  size="lg"
                  colorScheme="green"
                  w="full"
                  borderRadius="md"
                  hasStripe
                  isAnimated
                />
                <Text color="gray.400" fontSize="sm">
                  {analysisProgress < 50
                    ? 'Extracting pose landmarks...'
                    : analysisProgress < 75
                    ? 'Validating form...'
                    : 'Generating report...'}
                </Text>
                
                {/* Legend for visualization */}
                {showVisualization && currentAnalysisFrame && (
                  <HStack spacing={4} fontSize="xs" color="gray.500">
                    <HStack>
                      <Box w={3} h={3} bg="#00ff00" borderRadius="sm" />
                      <Text>Good form</Text>
                    </HStack>
                    <HStack>
                      <Box w={3} h={3} bg="#ff4444" borderRadius="sm" />
                      <Text>Needs attention</Text>
                    </HStack>
                    <HStack>
                      <Box w={3} h={3} bg="#00ffff" borderRadius="full" />
                      <Text>Joint</Text>
                    </HStack>
                  </HStack>
                )}
              </VStack>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
};

export default RecordPage;
