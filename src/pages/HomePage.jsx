import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  Stack,
  Badge,
  Button,
  Flex,
  Icon,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Divider
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FaDumbbell, FaChartLine, FaHistory, FaPlayCircle } from 'react-icons/fa';
import { EXERCISES, EXERCISE_CATEGORIES } from '../config/exercises';
import storageService from '../services/storage';

const HomePage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const cardBg = useColorModeValue('gray.800', 'gray.800');
  const borderColor = useColorModeValue('gray.700', 'gray.700');

  useEffect(() => {
    // Load stats for all exercises
    const allStats = {};
    Object.values(EXERCISES).forEach(exercise => {
      allStats[exercise.id] = storageService.getExerciseStats(exercise.id);
    });
    setStats(allStats);

    // Load recent workouts
    setRecentWorkouts(storageService.getRecentWorkouts(5));
  }, []);

  const handleSelectExercise = (exerciseId) => {
    onClose();
    navigate(`/record/${exerciseId}`);
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading 
            size="2xl" 
            mb={2} 
            bgGradient="linear(to-r, red.400, orange.400)" 
            bgClip="text"
            letterSpacing="tight"
          >
            FORM ADVISOR
          </Heading>
          <Text color="gray.400" fontSize="lg">
            AI-powered exercise technique analysis
          </Text>
        </Box>

        {/* Main Action Button */}
        <Card 
          bg="gray.800" 
          borderWidth="2px" 
          borderColor="red.500"
          boxShadow="0 0 30px rgba(239, 68, 68, 0.3)"
        >
          <CardBody>
            <VStack spacing={4}>
              <Icon as={FaPlayCircle} boxSize={12} color="red.500" />
              <Heading size="lg" color="white">
                Ready to Analyze Your Form?
              </Heading>
              <Text color="gray.400" textAlign="center">
                Record or upload a video to get instant feedback on your technique
              </Text>
              <Button
                size="lg"
                colorScheme="red"
                onClick={onOpen}
                px={12}
                py={6}
                fontSize="xl"
                height="auto"
              >
                Select Exercise
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Quick Stats */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Total Sessions</StatLabel>
                <StatNumber color="white" fontSize="3xl">
                  {Object.values(stats).reduce((sum, s) => sum + s.totalSessions, 0)}
                </StatNumber>
                <StatHelpText color="gray.500">All time</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Average Score</StatLabel>
                <StatNumber color="green.400" fontSize="3xl">
                  {Object.values(stats).length > 0
                    ? Math.round(
                        Object.values(stats).reduce((sum, s) => sum + s.averageScore, 0) /
                          Object.values(stats).filter(s => s.averageScore > 0).length || 1
                      )
                    : 0}
                </StatNumber>
                <StatHelpText color="gray.500">Across all exercises</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.400">Exercises Tracked</StatLabel>
                <StatNumber color="orange.400" fontSize="3xl">
                  {Object.values(stats).filter(s => s.totalSessions > 0).length}
                </StatNumber>
                <StatHelpText color="gray.500">Out of {Object.keys(EXERCISES).length}</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Recent Activity */}
        {recentWorkouts.length > 0 && (
          <Box>
            <Flex align="center" mb={4}>
              <Icon as={FaHistory} color="blue.400" mr={3} boxSize={6} />
              <Heading size="lg" color="white">
                Recent Activity
              </Heading>
            </Flex>

            <Stack spacing={3}>
              {recentWorkouts.map((workout) => {
                const exercise = EXERCISES[workout.exerciseId.toUpperCase()];
                if (!exercise) return null;

                return (
                  <Card key={workout.id} bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                    <CardBody>
                      <Flex justify="space-between" align="center">
                        <Flex align="center" gap={3}>
                          <Text fontSize="3xl">{exercise.icon}</Text>
                          <Box>
                            <Text fontWeight="bold" color="white" fontSize="lg">
                              {exercise.name}
                            </Text>
                            <Text fontSize="sm" color="gray.500">
                              {new Date(workout.timestamp).toLocaleDateString()}
                            </Text>
                          </Box>
                        </Flex>
                        <Badge
                          colorScheme={
                            workout.score >= 80 ? 'green' : workout.score >= 60 ? 'orange' : 'red'
                          }
                          fontSize="lg"
                          px={4}
                          py={2}
                        >
                          Score: {workout.score}
                        </Badge>
                      </Flex>
                    </CardBody>
                  </Card>
                );
              })}
            </Stack>

            <Button
              variant="ghost"
              colorScheme="blue"
              mt={4}
              onClick={() => navigate('/history')}
              rightIcon={<FaChartLine />}
              w="full"
            >
              View Full History
            </Button>
          </Box>
        )}
      </VStack>

      {/* Exercise Selection Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <ModalHeader color="white">
            <Heading size="lg">Select Exercise</Heading>
          </ModalHeader>
          <ModalCloseButton color="gray.400" />
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              {Object.entries(EXERCISE_CATEGORIES).map(([categoryKey, category]) => (
                <Box key={categoryKey}>
                  <Flex align="center" mb={3}>
                    <Icon as={FaDumbbell} color={`${category.color}.400`} mr={2} />
                    <Heading size="md" color="white">
                      {category.name}
                    </Heading>
                  </Flex>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {category.exercises.map((exercise) => {
                      const exerciseStats = stats[exercise.id] || {};
                      const hasData = exerciseStats.totalSessions > 0;

                      return (
                        <Card
                          key={exercise.id}
                          bg="gray.900"
                          borderWidth="1px"
                          borderColor="gray.700"
                          cursor="pointer"
                          transition="all 0.2s"
                          _hover={{
                            transform: 'scale(1.02)',
                            borderColor: `${category.color}.500`,
                            boxShadow: `0 0 15px rgba(${category.color === 'red' ? '239, 68, 68' : '251, 146, 60'}, 0.4)`
                          }}
                          onClick={() => handleSelectExercise(exercise.id)}
                        >
                          <CardBody>
                            <Flex align="center" gap={3} mb={2}>
                              <Text fontSize="2xl">{exercise.icon}</Text>
                              <Box flex={1}>
                                <Text fontWeight="bold" color="white">
                                  {exercise.name}
                                </Text>
                                {hasData && (
                                  <Text fontSize="xs" color="gray.500">
                                    {exerciseStats.totalSessions} sessions
                                  </Text>
                                )}
                              </Box>
                            </Flex>
                            {hasData && (
                              <Flex gap={3} mt={2}>
                                <Box>
                                  <Text fontSize="xs" color="gray.500">
                                    Best
                                  </Text>
                                  <Text fontSize="md" fontWeight="bold" color="green.400">
                                    {exerciseStats.bestScore}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text fontSize="xs" color="gray.500">
                                    Avg
                                  </Text>
                                  <Text fontSize="md" fontWeight="bold" color="orange.400">
                                    {Math.round(exerciseStats.averageScore)}
                                  </Text>
                                </Box>
                              </Flex>
                            )}
                          </CardBody>
                        </Card>
                      );
                    })}
                  </SimpleGrid>

                  {categoryKey !== Object.keys(EXERCISE_CATEGORIES)[Object.keys(EXERCISE_CATEGORIES).length - 1] && (
                    <Divider mt={6} borderColor="gray.700" />
                  )}
                </Box>
              ))}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default HomePage;
