import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Button,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Flex,
  Icon,
  Divider,
  List,
  ListItem,
  ListIcon,
  Collapse
} from '@chakra-ui/react';
import { 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaTimesCircle,
  FaHome,
  FaRedo,
  FaChartLine,
  FaLightbulb,
  FaCamera,
  FaStopwatch,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';
import { getExerciseById } from '../config/exercises';

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { workout, exerciseData, adaptiveReport, repAnalysis } = location.state || {};
  const [expandedIssues, setExpandedIssues] = useState({});

  // Toggle issue examples visibility
  const toggleIssueExamples = (issueId) => {
    setExpandedIssues(prev => ({
      ...prev,
      [issueId]: !prev[issueId]
    }));
  };

  // Get full exercise object for form tips
  const exercise = exerciseData ? getExerciseById(exerciseData.id) : null;

  if (!workout || !exerciseData) {
    navigate('/');
    return null;
  }

  const getSeverityStatus = (severity) => {
    const statusMap = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'info'
    };
    return statusMap[severity] || 'warning';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'red',
      high: 'red',
      medium: 'orange',
      low: 'yellow'
    };
    return colors[severity] || 'gray';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: FaTimesCircle,
      high: FaExclamationTriangle,
      medium: FaExclamationTriangle,
      low: FaLightbulb
    };
    return icons[severity] || FaExclamationTriangle;
  };

  const getScoreColor = (score) => {
    if (score >= 85) return 'green';
    if (score >= 70) return 'blue';
    if (score >= 55) return 'orange';
    return 'red';
  };

  const getScoreMessage = (score) => {
    if (score >= 85) return 'Excellent form! Keep up the great work.';
    if (score >= 70) return 'Good form with minor areas for improvement.';
    if (score >= 55) return 'Decent form, but several corrections needed.';
    return 'Form needs significant improvement. Consider lowering weight.';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'green';
    if (confidence >= 0.7) return 'yellow';
    if (confidence >= 0.5) return 'orange';
    return 'red';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.9) return 'Full Analysis';
    if (confidence >= 0.7) return 'Partial Analysis';
    if (confidence >= 0.5) return 'Limited Analysis';
    return 'Insufficient Analysis';
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Box>
            <Heading size="xl" color="white" mb={2}>
              <Text as="span" fontSize="3xl" mr={3}>
                {exerciseData.icon}
              </Text>
              {exerciseData.name} - Results
            </Heading>
            <Text color="gray.400">
              {workout.reps > 0 && `${workout.reps} reps`}
              {workout.weight > 0 && ` @ ${workout.weight} lbs`}
            </Text>
          </Box>
        </Flex>

        {/* Overall Score */}
        <Card
          bg="gray.800"
          borderWidth="2px"
          borderColor={`${getScoreColor(workout.score)}.500`}
          boxShadow={`0 0 20px rgba(${getScoreColor(workout.score) === 'red' ? '239, 68, 68' : getScoreColor(workout.score) === 'green' ? '34, 197, 94' : '251, 146, 60'}, 0.3)`}
        >
          <CardBody>
            <VStack spacing={4}>
              <Box textAlign="center">
                <Text fontSize="sm" color="gray.400" mb={2}>
                  FORM SCORE
                </Text>
                <Heading
                  size="4xl"
                  bgGradient={`linear(to-r, ${getScoreColor(workout.score)}.400, ${getScoreColor(workout.score)}.600)`}
                  bgClip="text"
                >
                  {workout.score}
                  <Text as="span" fontSize="2xl" color="gray.500">
                    /100
                  </Text>
                </Heading>
              </Box>

              <Progress
                value={workout.score}
                colorScheme={getScoreColor(workout.score)}
                size="lg"
                w="full"
                borderRadius="md"
              />

              <Text color="gray.300" textAlign="center" fontSize="lg">
                {getScoreMessage(workout.score)}
              </Text>

              <Text fontSize="sm" color="gray.500">
                Based on {workout.frameCount} analyzed frames
              </Text>
            </VStack>
          </CardBody>
        </Card>

        {/* Rep Analysis Card */}
        {(workout.detectedReps > 0 || repAnalysis) && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader>
              <Heading size="md" color="white">
                <Icon as={FaStopwatch} color="blue.400" mr={2} />
                Rep Analysis
              </Heading>
            </CardHeader>
            <CardBody>
              <HStack spacing={8} wrap="wrap" justify="space-around">
                <VStack>
                  <Text fontSize="3xl" fontWeight="bold" color="blue.400">
                    {workout.detectedReps || 0}
                  </Text>
                  <Text fontSize="sm" color="gray.400">Detected Reps</Text>
                </VStack>
                {workout.userEnteredReps > 0 && workout.userEnteredReps !== workout.detectedReps && (
                  <VStack>
                    <Text fontSize="3xl" fontWeight="bold" color="gray.400">
                      {workout.userEnteredReps}
                    </Text>
                    <Text fontSize="sm" color="gray.400">User Entered</Text>
                  </VStack>
                )}
                {workout.repAnalysis && (
                  <>
                    <VStack>
                      <Text fontSize="3xl" fontWeight="bold" color="green.400">
                        {workout.repAnalysis.avgDuration.toFixed(1)}s
                      </Text>
                      <Text fontSize="sm" color="gray.400">Avg Duration</Text>
                    </VStack>
                    <VStack>
                      <Text fontSize="3xl" fontWeight="bold" color="purple.400">
                        {Math.round(workout.repAnalysis.consistency)}%
                      </Text>
                      <Text fontSize="sm" color="gray.400">Consistency</Text>
                    </VStack>
                    <VStack>
                      <Text fontSize="3xl" fontWeight="bold" color="orange.400">
                        {Math.round(workout.repAnalysis.tempoScore)}%
                      </Text>
                      <Text fontSize="sm" color="gray.400">Tempo Score</Text>
                    </VStack>
                  </>
                )}
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Adaptive Analysis Warning removed */}

        {/* Score Breakdown (when limited analysis) */}
        {workout.baseScore !== workout.score && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader pb={2}>
              <Heading size="sm" color="white">
                <Icon as={FaInfoCircle} color="blue.400" mr={2} />
                Score Breakdown
              </Heading>
            </CardHeader>
            <CardBody pt={2}>
              <HStack spacing={4} fontSize="sm">
                <Text color="gray.400">
                  Base Score: <Text as="span" color="white" fontWeight="bold">{workout.baseScore}</Text>
                </Text>
                <Text color="gray.400">×</Text>
                <Text color="gray.400">
                  Analysis Completeness: <Text as="span" color="white" fontWeight="bold">
                    {Math.round((workout.score / workout.baseScore) * 100)}%
                  </Text>
                </Text>
                <Text color="gray.400">=</Text>
                <Text color={`${getScoreColor(workout.score)}.400`} fontWeight="bold">
                  Final Score: {workout.score}
                </Text>
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Form Analysis */}
        {workout.errors && workout.errors.length > 0 ? (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader>
              <Heading size="lg" color="white">
                Form Corrections Needed
              </Heading>
              <Text color="gray.400" fontSize="sm" mt={1}>
                Issues detected in your technique
              </Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                {workout.errors.map((error, index) => {
                  const issueFrames = workout.issueSamples?.[error.id];
                  const hasExamples = issueFrames && issueFrames.length > 0;
                  const isExpanded = expandedIssues[error.id];
                  
                  return (
                    <Alert
                      key={index}
                      status={getSeverityStatus(error.severity)}
                      variant="left-accent"
                      bg={`${getSeverityColor(error.severity)}.900`}
                      borderWidth="1px"
                      borderColor={`${getSeverityColor(error.severity)}.700`}
                      borderRadius="md"
                      flexDirection="column"
                      alignItems="stretch"
                    >
                      <Flex>
                        <AlertIcon as={getSeverityIcon(error.severity)} mt={1} />
                        <Box flex="1">
                          <Flex justify="space-between" align="center" mb={2}>
                            <AlertTitle color="white">{error.name}</AlertTitle>
                            <HStack spacing={2}>
                              <Badge
                                colorScheme={getSeverityColor(error.severity)}
                                fontSize="xs"
                              >
                                {error.severity.toUpperCase()}
                              </Badge>
                              <Badge colorScheme="gray" fontSize="xs">
                                {Math.round(error.frequency * 100)}% of reps
                              </Badge>
                            </HStack>
                          </Flex>
                          <AlertDescription color="gray.300" fontSize="sm" mb={3}>
                            {error.description}
                          </AlertDescription>
                          <Box
                            bg={`${getSeverityColor(error.severity)}.800`}
                            p={3}
                            borderRadius="md"
                            borderLeftWidth="3px"
                            borderLeftColor="green.400"
                          >
                            <Text fontSize="sm" color="green.300" fontWeight="bold" mb={1}>
                              How to fix:
                            </Text>
                            <Text fontSize="sm" color="gray.200">
                              {error.correction}
                            </Text>
                          </Box>
                          
                          {/* Examples dropdown button */}
                          {hasExamples && (
                            <Button
                              size="sm"
                              variant="ghost"
                              colorScheme={getSeverityColor(error.severity)}
                              mt={3}
                              leftIcon={<Icon as={FaCamera} />}
                              rightIcon={<Icon as={isExpanded ? FaChevronUp : FaChevronDown} />}
                              onClick={() => toggleIssueExamples(error.id)}
                            >
                              {isExpanded ? 'Hide' : 'Show'} Examples ({issueFrames.length} frame{issueFrames.length !== 1 ? 's' : ''})
                            </Button>
                          )}
                        </Box>
                      </Flex>
                      
                      {/* Collapsible examples section */}
                      {hasExamples && (
                        <Collapse in={isExpanded} animateOpacity>
                          <Box mt={3} pt={3} borderTopWidth="1px" borderTopColor={`${getSeverityColor(error.severity)}.700`}>
                            <Text color="gray.400" fontSize="xs" mb={2}>
                              Frames showing this issue from start to finish:
                            </Text>
                            <HStack spacing={3} overflowX="auto" pb={2}>
                              {issueFrames.map((frameData, idx) => (
                                <Box
                                  key={idx}
                                  position="relative"
                                  minW="150px"
                                  h="100px"
                                  borderRadius="md"
                                  overflow="hidden"
                                  borderWidth="2px"
                                  borderColor={`${getSeverityColor(error.severity)}.500`}
                                  cursor="pointer"
                                  transition="all 0.2s"
                                  _hover={{ transform: 'scale(1.05)', borderColor: `${getSeverityColor(error.severity)}.300` }}
                                >
                                  {frameData.dataUrl && (
                                    <img
                                      src={frameData.dataUrl}
                                      alt={`${error.name} - frame ${idx + 1}`}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  )}
                                  <Badge
                                    position="absolute"
                                    bottom={1}
                                    right={1}
                                    fontSize="xs"
                                    colorScheme="gray"
                                  >
                                    {idx === 0 ? 'Start' : idx === issueFrames.length - 1 ? 'End' : 'Mid'}
                                  </Badge>
                                </Box>
                              ))}
                            </HStack>
                            <Text color="gray.500" fontSize="xs" mt={1}>
                              Progression: {issueFrames.length === 1 ? 'Single instance' : `Start → ${issueFrames.length > 2 ? 'Middle → ' : ''}End`}
                            </Text>
                          </Box>
                        </Collapse>
                      )}
                    </Alert>
                  );
                })}
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <Alert
            status="success"
            variant="left-accent"
            bg="green.900"
            borderWidth="1px"
            borderColor="green.700"
            borderRadius="md"
          >
            <AlertIcon as={FaCheckCircle} />
            <Box>
              <AlertTitle color="white" mb={1}>
                Excellent Form!
              </AlertTitle>
              <AlertDescription color="gray.300">
                No major form issues detected. Keep up the great work and continue focusing on
                consistency and progressive overload.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Exercise Tips */}
        {exercise && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardHeader>
              <Heading size="md" color="white">
                <Icon as={FaLightbulb} color="yellow.400" mr={2} />
                Key Form Points for {exerciseData.name}
              </Heading>
            </CardHeader>
            <CardBody>
              <List spacing={2}>
                {exercise.formTips.map((tip, i) => (
                  <ListItem key={i} color="gray.300" fontSize="sm">
                    <ListIcon as={FaCheckCircle} color="green.400" />
                    {tip}
                  </ListItem>
                ))}
              </List>
            </CardBody>
          </Card>
        )}

        <Divider borderColor="gray.700" />

        {/* Action Buttons */}
        <HStack spacing={4}>
          <Button
            leftIcon={<FaRedo />}
            colorScheme="orange"
            size="lg"
            flex={1}
            onClick={() => navigate(`/record/${exerciseData.id}`)}
          >
            Record Another Set
          </Button>
          <Button
            leftIcon={<FaChartLine />}
            colorScheme="blue"
            variant="outline"
            size="lg"
            flex={1}
            onClick={() => navigate('/history')}
          >
            View Progress
          </Button>
          <Button
            leftIcon={<FaHome />}
            variant="ghost"
            size="lg"
            onClick={() => navigate('/')}
          >
            Home
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
};

export default ResultsPage;
