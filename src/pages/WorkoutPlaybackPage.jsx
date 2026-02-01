import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Progress,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Badge,
  Alert,
  AlertIcon,
  Spinner
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { FaPlay, FaPause } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import storageService from '../services/storage';
import poseAnalysisService from '../services/poseAnalysis';

const WorkoutPlaybackPage = () => {
  const navigate = useNavigate();
  const { workoutId } = useParams();
  
  // Playback state
  const [workout, setWorkout] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedRep, setSelectedRep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Video and canvas refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const frameDataRef = useRef(null);

  // Load workout and frame data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        frameDataRef.current = null; // Reset frame data cache
        const workoutData = storageService.getWorkout(workoutId);
        
        if (!workoutData) {
          setError('Workout not found');
          setLoading(false);
          return;
        }

        setWorkout(workoutData);
        
        // Load video blob
        const videoBlob = await storageService.getVideoBlob(workoutId);
        if (videoBlob && videoRef.current) {
          const videoUrl = URL.createObjectURL(videoBlob);
          videoRef.current.src = videoUrl;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading workout:', err);
        setError('Failed to load workout data');
        setLoading(false);
      }
    };
    loadData();
  }, [workoutId]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Synchronize canvas with video and draw skeleton
  const drawFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match video
    if (video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw video frame
    ctx.drawImage(video, 0, 0);

    // Load and draw frame analysis data
    try {
      if (!frameDataRef.current) {
        const data = await storageService.getWorkoutFrameData(workoutId);
        frameDataRef.current = data;
      }
      
      // Handle different frame data formats (backwards compatibility)
      let frames = null;
      if (frameDataRef.current) {
        if (Array.isArray(frameDataRef.current.frames)) {
          // New format: { workoutId, frames: [...] }
          frames = frameDataRef.current.frames;
        } else if (frameDataRef.current.frames?.frames) {
          // Old nested format: { workoutId, frames: { frames: [...] } }
          frames = frameDataRef.current.frames.frames;
        }
      }
      
      if (frames && frames.length > 0) {
        // Find closest frame by time using binary search for better performance
        const currentVideoTime = video.currentTime;
        
        // Binary search to find closest frame
        let left = 0;
        let right = frames.length - 1;
        let closestFrame = frames[0];
        let minTimeDiff = Math.abs(frames[0].time - currentVideoTime);
        
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          const timeDiff = Math.abs(frames[mid].time - currentVideoTime);
          
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestFrame = frames[mid];
          }
          
          if (frames[mid].time < currentVideoTime) {
            left = mid + 1;
          } else {
            right = mid - 1;
          }
        }

        if (closestFrame && closestFrame.landmarks) {
          // Draw skeleton using analysis service
          poseAnalysisService.drawSkeleton(
            canvas,
            closestFrame.landmarks,
            closestFrame.errors || []
          );
        }
      }
    } catch (err) {
      console.error('Error drawing frame:', err);
    }
  }, [workoutId]);

  // Animation loop for playback
  useEffect(() => {
    let running = true;
    
    const animate = () => {
      if (!running) return;
      
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        if (isPlaying || videoRef.current.paused === false) {
          drawFrame();
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, workoutId, drawFrame]);

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Jump to rep
  const jumpToRep = (repIndex) => {
    if (workout && workout.repRanges && videoRef.current) {
      const repRange = workout.repRanges[repIndex];
      const startTime = repRange.startFrame / 30; // Convert frame to time
      videoRef.current.currentTime = startTime;
      setSelectedRep(repIndex);
      setCurrentTime(startTime);
      
      // Draw frame after seek completes for better synchronization
      videoRef.current.addEventListener('seeked', () => {
        drawFrame();
      }, { once: true });
    }
  };

  if (loading) {
    return (
      <VStack spacing={8} align="center" justify="center" minH="100vh">
        <Spinner size="xl" />
        <Text>Loading workout...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack spacing={4} align="stretch" p={4}>
        <HStack>
          <Button
            leftIcon={<ArrowBackIcon />}
            variant="ghost"
            onClick={() => navigate('/history')}
          >
            Back to History
          </Button>
        </HStack>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      </VStack>
    );
  }

  if (!workout) return null;

  const exerciseName = workout.exerciseId || 'Unknown Exercise';
  const repCount = workout.reps || 0;
  const score = workout.score || 0;

  return (
    <VStack spacing={6} align="stretch" p={4} maxW="1200px" mx="auto">
      {/* Header */}
      <HStack justify="space-between" align="center">
        <HStack>
          <Button
            leftIcon={<ArrowBackIcon />}
            variant="ghost"
            onClick={() => navigate('/history')}
          >
            Back to History
          </Button>
        </HStack>
        <VStack spacing={0} align="flex-start">
          <Heading size="lg">{exerciseName}</Heading>
          <Text fontSize="sm" color="gray.600">
            {new Date(workout.timestamp).toLocaleDateString()} -{' '}
            {workout.weight}kg × {repCount} reps
          </Text>
        </VStack>
        <Badge colorScheme={score > 70 ? 'green' : score > 50 ? 'yellow' : 'red'} fontSize="md" p={2}>
          Score: {Math.round(score)}/100
        </Badge>
      </HStack>

      {/* Video and Canvas */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Box
              ref={containerRef}
              position="relative"
              bg="black"
              borderRadius="md"
              overflow="hidden"
              aspectRatio="16/9"
              maxW="100%"
            >
              {/* Canvas overlay */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%'
                }}
              />
              {/* Hidden video element */}
              <video
                ref={videoRef}
                onLoadedMetadata={handleLoadedMetadata}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%'
                }}
              />
            </Box>

            {/* Playback Controls */}
            <VStack spacing={3} align="stretch">
              {/* Progress bar */}
              <Box>
                <HStack justify="space-between" fontSize="sm" mb={2}>
                  <Text>{formatTime(currentTime)}</Text>
                  <Text>{formatTime(duration)}</Text>
                </HStack>
                <Progress
                  value={(currentTime / duration) * 100}
                  size="sm"
                  borderRadius="full"
                  cursor="pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    if (videoRef.current) {
                      const newTime = percent * duration;
                      videoRef.current.currentTime = newTime;
                      setCurrentTime(newTime);
                      
                      // Draw frame after seek completes for better synchronization
                      videoRef.current.addEventListener('seeked', () => {
                        drawFrame();
                      }, { once: true });
                    }
                  }}
                />
              </Box>

              {/* Play/Pause Controls */}
              <HStack justify="center" spacing={4}>
                <Button
                  size="lg"
                  colorScheme="blue"
                  leftIcon={isPlaying ? <FaPause /> : <FaPlay />}
                  onClick={handlePlayPause}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
              </HStack>
            </VStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Rep Overview */}
      {workout.repRanges && workout.repRanges.length > 0 && (
        <Card>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Heading size="md">Reps ({workout.repRanges.length})</Heading>
              
              <SimpleGrid columns={{ base: 2, md: 4, lg: 5 }} spacing={3}>
                {workout.repRanges.map((rep, idx) => {
                  const repAnalysis = workout.repProgressionAnalyses?.[idx];
                  const quality = repAnalysis?.quality || {};
                  const avgQuality = (
                    (quality.smoothness || 0) +
                    (quality.symmetry || 0) +
                    (quality.controlledTempo || 0)
                  ) / 3;

                  return (
                    <Button
                      key={idx}
                      variant={selectedRep === idx ? 'solid' : 'outline'}
                      colorScheme="blue"
                      h="auto"
                      py={3}
                      flexDirection="column"
                      onClick={() => jumpToRep(idx)}
                      fontSize="sm"
                      isActive={selectedRep === idx}
                    >
                      <Text fontWeight="bold">Rep {idx + 1}</Text>
                      <Progress
                        value={avgQuality}
                        size="xs"
                        w="100%"
                        mt={1}
                        borderRadius="full"
                        colorScheme={avgQuality > 70 ? 'green' : avgQuality > 50 ? 'yellow' : 'red'}
                      />
                      <Text fontSize="xs" mt={1}>
                        {Math.round(avgQuality)}/100
                      </Text>
                    </Button>
                  );
                })}
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Rep Details */}
      {selectedRep !== null && workout.repProgressionAnalyses && workout.repProgressionAnalyses[selectedRep] && (
        <Card>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Heading size="md">Rep {selectedRep + 1} Analysis</Heading>
              
              <SimpleGrid columns={3} spacing={4}>
                <Box>
                  <Text fontSize="sm" color="gray.600">Smoothness</Text>
                  <HStack>
                    <Progress
                      value={workout.repProgressionAnalyses[selectedRep].quality.smoothness}
                      size="lg"
                      flex={1}
                      colorScheme="green"
                      borderRadius="full"
                    />
                    <Text fontWeight="bold" minW="40px">
                      {Math.round(workout.repProgressionAnalyses[selectedRep].quality.smoothness)}
                    </Text>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="sm" color="gray.600">Symmetry</Text>
                  <HStack>
                    <Progress
                      value={workout.repProgressionAnalyses[selectedRep].quality.symmetry}
                      size="lg"
                      flex={1}
                      colorScheme="blue"
                      borderRadius="full"
                    />
                    <Text fontWeight="bold" minW="40px">
                      {Math.round(workout.repProgressionAnalyses[selectedRep].quality.symmetry)}
                    </Text>
                  </HStack>
                </Box>

                <Box>
                  <Text fontSize="sm" color="gray.600">Tempo Control</Text>
                  <HStack>
                    <Progress
                      value={workout.repProgressionAnalyses[selectedRep].quality.controlledTempo}
                      size="lg"
                      flex={1}
                      colorScheme="orange"
                      borderRadius="full"
                    />
                    <Text fontWeight="bold" minW="40px">
                      {Math.round(workout.repProgressionAnalyses[selectedRep].quality.controlledTempo)}
                    </Text>
                  </HStack>
                </Box>
              </SimpleGrid>

              {/* Phase Breakdown */}
              {workout.repProgressionAnalyses[selectedRep].phases && (
                <Box pt={4} borderTop="1px solid" borderColor="gray.200">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>Movement Phases</Text>
                  <SimpleGrid columns={4} spacing={2}>
                    {Object.entries(workout.repProgressionAnalyses[selectedRep].phases).map(
                      ([phase, data]) => (
                        <Box key={phase} p={2} bg="gray.100" borderRadius="md">
                          <Text fontSize="xs" fontWeight="bold" textTransform="capitalize">
                            {phase}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {data.duration}ms
                          </Text>
                        </Box>
                      )
                    )}
                  </SimpleGrid>
                </Box>
              )}

              {/* Issues */}
              {workout.repProgressionAnalyses[selectedRep].issues && 
               workout.repProgressionAnalyses[selectedRep].issues.length > 0 && (
                <Box pt={4} borderTop="1px solid" borderColor="gray.200">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>Issues Detected</Text>
                  <VStack spacing={2} align="stretch">
                    {workout.repProgressionAnalyses[selectedRep].issues.map((issue, idx) => (
                      <Box key={idx} p={2} bg="red.50" borderLeft="4px solid red" borderRadius="sm">
                        <Text fontSize="sm" fontWeight="bold" color="red.700">
                          {issue.name}
                        </Text>
                        <Text fontSize="xs" color="red.600">
                          {issue.description}
                        </Text>
                        {issue.correction && (
                          <Text fontSize="xs" mt={1} color="blue.600">
                            💡 {issue.correction}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Overall Stats */}
      <Card>
        <CardBody>
          <SimpleGrid columns={4} spacing={4}>
            <Box>
              <Text fontSize="sm" color="gray.600">Total Reps</Text>
              <Text fontSize="2xl" fontWeight="bold">{repCount}</Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.600">Weight</Text>
              <Text fontSize="2xl" fontWeight="bold">{workout.weight}kg</Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.600">Duration</Text>
              <Text fontSize="2xl" fontWeight="bold">{formatTime(duration)}</Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.600">Overall Score</Text>
              <Text fontSize="2xl" fontWeight="bold" color={score > 70 ? 'green.600' : 'orange.600'}>
                {Math.round(score)}/100
              </Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>
    </VStack>
  );
};

/**
 * Format time in MM:SS
 */
const formatTime = (seconds) => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default WorkoutPlaybackPage;
