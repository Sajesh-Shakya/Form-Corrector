import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChakraProvider, extendTheme, Box } from '@chakra-ui/react';
import HomePage from './pages/HomePage';
import RecordPage from './pages/RecordPage';
import ResultsPage from './pages/ResultsPage';
import HistoryPage from './pages/HistoryPage';
import WorkoutPlaybackPage from './pages/WorkoutPlaybackPage';

// Dark theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.950',
        color: 'white',
      },
    },
  },
  colors: {
    gray: {
      950: '#0a0a0a',
      900: '#141414',
      800: '#1f1f1f',
      700: '#2d2d2d',
    },
  },
  fonts: {
    heading: '"Bebas Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"Barlow", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'red',
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'gray.800',
          borderColor: 'gray.700',
        },
      },
    },
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Box minH="100vh" bg="gray.950">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/record/:exerciseId" element={<RecordPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/playback/:workoutId" element={<WorkoutPlaybackPage />} />
          </Routes>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;
