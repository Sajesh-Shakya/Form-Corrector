# Exercise Form Advisor

AI-powered exercise technique analysis using MediaPipe Pose estimation and angle-based form validation.

## Features

### 🏋️ Multi-Exercise Support
- **Barbell Squat** - Knee tracking, depth analysis, forward lean detection
- **Deadlift** - Back position, hip placement, bar path
- **Overhead Press** - Back arch, lockout completion
- **Bench Press** - Elbow flare detection
- **Pull-Up** - Range of motion validation

### 📊 Comprehensive Tracking
- Workout history with timestamps
- Weight and rep tracking
- Progress charts and statistics
- Common mistake identification
- Form score trends

### 🎯 Smart Analysis
- Real-time pose landmark detection via MediaPipe
- Angle-based form validation (more reliable than ML classifiers)
- Frame-by-frame error frequency tracking
- Severity-based error prioritization
- Personalized correction tips

### 💾 Data Persistence
- Local storage for all workout data
- Exercise-specific statistics
- Common error tracking
- Export/import functionality
- Ready for Supabase integration

## Architecture

### Clean Separation of Concerns

```
src/
├── config/          # Exercise definitions and validation rules
│   └── exercises.js
├── services/        # Business logic layer
│   ├── poseAnalysis.js  # MediaPipe integration
│   └── storage.js       # Data persistence
├── utils/           # Helper functions
│   └── videoProcessing.js
├── pages/           # Route components
│   ├── HomePage.jsx
│   ├── RecordPage.jsx
│   ├── ResultsPage.jsx
│   └── HistoryPage.jsx
└── App.js           # Routing and theme
```

### Design Patterns

1. **Service Layer Pattern** - Decoupled business logic from UI
2. **Strategy Pattern** - Exercise-specific validation rules
3. **Repository Pattern** - Abstract storage implementation
4. **Factory Pattern** - Dynamic exercise analysis

## Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Environment

No environment variables needed for local development. MediaPipe Pose runs entirely in the browser via CDN.

## Adding New Exercises

1. Define exercise in `src/config/exercises.js`:

```javascript
MY_EXERCISE: {
  id: 'my_exercise',
  name: 'My Exercise',
  category: 'lower_body', // or 'upper_body'
  icon: '💪',
  description: '...',
  musclesTargeted: ['...'],
  commonMistakes: ['...'],
  formTips: ['...'],
  landmarks: { /* MediaPipe indices */ },
  validationChecks: [
    {
      id: 'error_id',
      name: 'Error Name',
      severity: 'high', // critical, high, medium, low
      description: '...',
      correction: '...',
      validate: (landmarks, angles) => {
        // Return true if error detected
      }
    }
  ]
}
```

2. Add analysis method to `src/services/poseAnalysis.js`:

```javascript
analyzeMyExercise(landmarks) {
  // Calculate angles and distances
  // Return relevant metrics
}
```

3. Update the analysis map in `analyzeExercise()`

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Supabase Integration (Future)

Replace `src/services/storage.js` with Supabase client:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
)

// Implement same interface as current storage service
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Partial (camera permissions may require HTTPS)
- Mobile: Works best on Chrome/Safari with good lighting

## Performance Notes

- Video analysis runs client-side (no server needed)
- Frame sampling at 0.5s intervals balances accuracy/speed
- MediaPipe Pose uses WebGL for hardware acceleration
- Typical analysis time: 10-15 seconds per 30-second video

## Troubleshooting

### Camera not working
- Grant camera permissions
- Ensure HTTPS (required on mobile)
- Check browser console for errors

### Analysis fails
- Video must have clear view of full body
- Good lighting improves landmark detection
- Try reducing video length if timeout occurs

### Storage issues
- Check browser localStorage quota
- Use export/import for backups
- Clear data via browser dev tools if corrupted

## Future Enhancements

- [ ] Real-time analysis during recording
- [ ] Social features and leaderboards
- [ ] AI-generated corrective exercise videos
- [ ] Integration with fitness trackers
- [ ] Coach/trainer dashboard
- [ ] Progressive overload recommendations

## License

MIT
