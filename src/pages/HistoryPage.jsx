import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  Badge,
  Select,
  Flex,
  Icon,
  Button,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { FaChartLine, FaTrash, FaArrowLeft, FaPlay } from 'react-icons/fa';
import { EXERCISES } from '../config/exercises';
import storageService from '../services/storage';
import { format } from 'date-fns';

const HistoryPage = () => {
  const navigate = useNavigate();
  const [selectedExercise, setSelectedExercise] = useState('all');
  const [workouts, setWorkouts] = useState([]);
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedExercise]);

  const loadData = () => {
    let filteredWorkouts;
    if (selectedExercise === 'all') {
      filteredWorkouts = storageService.getAllWorkouts();
    } else {
      filteredWorkouts = storageService.getWorkoutsByExercise(selectedExercise);
    }

    filteredWorkouts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setWorkouts(filteredWorkouts);

    // Load stats
    const allStats = {};
    Object.values(EXERCISES).forEach(exercise => {
      allStats[exercise.id] = storageService.getExerciseStats(exercise.id);
    });
    setStats(allStats);

    // Prepare chart data
    const data = filteredWorkouts
      .slice(0, 20)
      .reverse()
      .map(w => ({
        date: format(new Date(w.timestamp), 'MM/dd'),
        score: w.score,
        weight: w.weight || 0
      }));
    setChartData(data);
  };

  const handleDeleteWorkout = (workoutId) => {
    if (window.confirm('Are you sure you want to delete this workout?')) {
      storageService.deleteWorkout(workoutId);
      loadData();
    }
  };

  const getExercise = (exerciseId) => {
    return Object.values(EXERCISES).find(e => e.id === exerciseId);
  };

  const getCurrentStats = () => {
    if (selectedExercise === 'all') {
      const totalSessions = Object.values(stats).reduce((sum, s) => sum + s.totalSessions, 0);
      const avgScore =
        Object.values(stats).reduce((sum, s) => sum + s.averageScore * s.totalSessions, 0) /
        totalSessions || 0;
      const bestScore = Math.max(...Object.values(stats).map(s => s.bestScore));
      
      return { totalSessions, averageScore: avgScore, bestScore };
    } else {
      return stats[selectedExercise] || { totalSessions: 0, averageScore: 0, bestScore: 0 };
    }
  };

  const currentStats = getCurrentStats();

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Box>
            <Heading size="xl" color="white" mb={2}>
              <Icon as={FaChartLine} mr={3} color="blue.400" />
              Workout History
            </Heading>
            <Text color="gray.400">Track your progress and form improvements</Text>
          </Box>
          <Button
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
        </Flex>

        {/* Exercise Filter */}
        <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <HStack spacing={4}>
              <Text color="gray.400" fontSize="sm" fontWeight="bold">
                Filter by Exercise:
              </Text>
              <Select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                bg="gray.900"
                borderColor="gray.600"
                maxW="300px"
              >
                <option value="all">All Exercises</option>
                {Object.values(EXERCISES).map(exercise => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.icon} {exercise.name}
                  </option>
                ))}
              </Select>
            </HStack>
          </CardBody>
        </Card>

        {/* Stats Summary */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Total Sessions</StatLabel>
                <StatNumber color="white">{currentStats.totalSessions}</StatNumber>
                <StatHelpText color="gray.500">
                  {selectedExercise === 'all' ? 'All exercises' : getExercise(selectedExercise)?.name}
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Average Score</StatLabel>
                <StatNumber color="blue.400">
                  {Math.round(currentStats.averageScore)}
                </StatNumber>
                <StatHelpText color="gray.500">
                  <StatArrow type={currentStats.averageScore >= 70 ? 'increase' : 'decrease'} />
                  Form quality
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Best Score</StatLabel>
                <StatNumber color="green.400">{currentStats.bestScore}</StatNumber>
                <StatHelpText color="gray.500">Personal best</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Progress Chart */}
        {chartData.length > 0 && (
          <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <Heading size="md" color="white" mb={4}>
                Score Progress
              </Heading>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Form Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* Workout List */}
        <Card bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <Heading size="md" color="white" mb={4}>
              Recent Workouts
            </Heading>

            {workouts.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>
                No workouts recorded yet. Start by recording your first set!
              </Text>
            ) : (
              <VStack spacing={3} align="stretch">
                {workouts.map((workout) => {
                  const exercise = getExercise(workout.exerciseId);
                  if (!exercise) return null;

                  return (
                    <Card
                      key={workout.id}
                      bg="gray.900"
                      borderWidth="1px"
                      borderColor="gray.700"
                      _hover={{ borderColor: 'gray.600' }}
                    >
                      <CardBody>
                        <Flex justify="space-between" align="center">
                          <HStack spacing={4} flex={1}>
                            <Text fontSize="3xl">{exercise.icon}</Text>
                            <Box>
                              <Text fontWeight="bold" color="white">
                                {exercise.name}
                              </Text>
                              <Text fontSize="sm" color="gray.500">
                                {format(new Date(workout.timestamp), 'MMM dd, yyyy - h:mm a')}
                              </Text>
                              {(workout.weight > 0 || workout.reps > 0) && (
                                <Text fontSize="xs" color="gray.600">
                                  {workout.reps > 0 && `${workout.reps} reps`}
                                  {workout.weight > 0 && ` @ ${workout.weight} lbs`}
                                </Text>
                              )}
                            </Box>
                          </HStack>

                          <HStack spacing={3}>
                            <Badge
                              colorScheme={
                                workout.score >= 80
                                  ? 'green'
                                  : workout.score >= 60
                                  ? 'blue'
                                  : 'orange'
                              }
                              fontSize="lg"
                              px={3}
                              py={1}
                            >
                              {workout.score}
                            </Badge>

                            {workout.errors && workout.errors.length > 0 && (
                              <Badge colorScheme="red" fontSize="sm">
                                {workout.errors.length} issue{workout.errors.length !== 1 ? 's' : ''}
                              </Badge>
                            )}

                            <Button
                              size="sm"
                              colorScheme="blue"
                              leftIcon={<FaPlay />}
                              onClick={() => navigate(`/playback/${workout.id}`)}
                            >
                              Watch
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              leftIcon={<FaTrash />}
                              onClick={() => handleDeleteWorkout(workout.id)}
                            >
                              Delete
                            </Button>
                          </HStack>
                        </Flex>

                        {workout.errors && workout.errors.length > 0 && (
                          <Box mt={3} pt={3} borderTopWidth="1px" borderColor="gray.700">
                            <Text fontSize="xs" color="gray.500" mb={2}>
                              FORM ISSUES:
                            </Text>
                            <HStack spacing={2} flexWrap="wrap">
                              {workout.errors.map((error, i) => (
                                <Badge key={i} colorScheme="orange" fontSize="xs">
                                  {error.name}
                                </Badge>
                              ))}
                            </HStack>
                          </Box>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </VStack>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
};

export default HistoryPage;
