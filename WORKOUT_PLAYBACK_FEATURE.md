# Workout Playback Feature Documentation

## Overview
The app now supports recording, analyzing, and replaying workouts with synchronized skeleton visualization. This allows users to review their exercise form in detail with visual feedback on detected form issues.

## Architecture

### 1. **Storage System (Enhanced)**
**File**: `src/services/storage.js`

#### IndexedDB Database Structure
The storage service now uses IndexedDB for large data storage alongside localStorage for metadata:

**Object Stores:**
- **workoutFrames**: Stores frame-by-frame analysis data
  - `workoutId`: Foreign key to workout
  - `frames`: Array of frame analysis objects
    - `time`: Timestamp within video
    - `landmarks`: MediaPipe pose landmarks (33 joints)
    - `errors`: Form validation errors for the frame
    - `metrics`: Movement metrics (depth, balance, alignment)

- **videos**: Stores the original video blob
  - `workoutId`: Unique identifier
  - `blob`: Binary video data
  - `size`: File size in bytes

- **analyses**: Stores detailed analysis data
  - `workoutId`: Unique identifier
  - `adaptiveAnalysis`: Camera angle and landmark availability
  - `repProgressionAnalyses`: Phase-aware analysis for each rep
  - `repConsistency`: Cross-rep metrics and fatigue detection

#### New Methods
```javascript
// Store frame data
await storageService.saveWorkoutFrameData(workoutId, frameData)

// Retrieve frame data
const frameData = await storageService.getWorkoutFrameData(workoutId)

// Store video blob
await storageService.saveVideoBlob(workoutId, videoBlob)

// Retrieve video blob
const blob = await storageService.getVideoBlob(workoutId)

// Store analysis
await storageService.saveAnalysisData(workoutId, analysisData)

// Retrieve analysis
const analysis = await storageService.getAnalysisData(workoutId)

// Delete all data for a workout
await storageService.deleteWorkoutData(workoutId)
```

### 2. **Workout Playback Component**
**File**: `src/pages/WorkoutPlaybackPage.jsx`

A full-featured video playback viewer with synchronized skeleton overlay.

#### Features
- **Video Playback Controls**
  - Play/pause button
  - Seekable progress bar
  - Time display (MM:SS format)

- **Skeleton Visualization**
  - Real-time canvas overlay on video
  - Color-coded joints:
    - 🟢 Green: Correct form
    - 🔴 Red: Form error detected
    - 🔵 Cyan: Joint visible but no error
  - Synchronized with video playback

- **Rep Navigation**
  - Individual rep buttons with quality scores
  - Jump to specific rep
  - Quality metrics per rep

- **Rep Analysis Details**
  - Smoothness score (0-100)
  - Symmetry score (0-100)
  - Tempo control score (0-100)
  - Movement phase breakdown
  - Detected form issues with corrections

- **Overall Stats**
  - Total reps performed
  - Weight used
  - Video duration
  - Overall form score

#### Data Flow
```
WorkoutPlaybackPage
├── Load workout metadata from localStorage
├── Load video blob from IndexedDB
├── Load frame data from IndexedDB
├── Render video player with canvas overlay
├── On play: animate skeleton synchronized with video
└── Display rep-by-rep analysis
```

### 3. **Recording Enhancement**
**File**: `src/pages/RecordPage.jsx`

Updated to store analysis data after workout completion.

#### Storage Process
1. **Video Recording**: Captured via MediaRecorder
2. **Frame Extraction**: Extract frames at adaptive rates (8-20 fps)
3. **Analysis**: Process each frame with pose detection
4. **Storage**:
   - **Frame Data**: Landmarks and validation results
   - **Video Blob**: Complete video file
   - **Analysis Data**: Rep progression, consistency, metrics

```javascript
// After analysis completes:
const savedWorkout = storageService.saveWorkout(workout);

// Store frame data
await storageService.saveWorkoutFrameData(savedWorkout.id, frameData);

// Store video blob
await storageService.saveVideoBlob(savedWorkout.id, videoBlob);

// Store detailed analysis
await storageService.saveAnalysisData(savedWorkout.id, {
  adaptiveAnalysis,
  repProgressionAnalyses,
  repConsistency
});
```

### 4. **Workout History Integration**
**File**: `src/pages/HistoryPage.jsx`

Added "Watch" button to view recorded workouts.

```jsx
<Button
  size="sm"
  colorScheme="blue"
  leftIcon={<FaPlay />}
  onClick={() => navigate(`/playback/${workout.id}`)}
>
  Watch
</Button>
```

### 5. **Routing**
**File**: `src/App.js`

New route for workout playback:
```javascript
<Route path="/playback/:workoutId" element={<WorkoutPlaybackPage />} />
```

## User Experience Flow

### Recording a Workout
1. User selects exercise → enters weight/reps → records video
2. App analyzes video during recording
3. Analysis completes with score and error feedback
4. Results page displays summary
5. **Automatic storage**:
   - Metadata (exercise, weight, score, errors)
   - Video blob
   - Frame-by-frame analysis
   - Rep progression data

### Reviewing a Workout
1. User navigates to "Workout History"
2. Sees list of past workouts with scores
3. Clicks "Watch" button on a workout
4. Playback page loads with:
   - Video player with skeleton overlay
   - Rep navigation buttons
   - Detailed rep analysis

### During Playback
1. User plays video
2. Skeleton overlay synchronizes with video
3. Joints highlighted (green/red/cyan) based on form
4. User can:
   - Pause and seek
   - Click rep buttons to jump to specific reps
   - View detailed analysis for each rep
   - See movement phase breakdown

## Technical Details

### Canvas Synchronization
The skeleton visualization is drawn on a canvas overlay that sits on top of the video element:

```javascript
// Canvas setup
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

// Draw video frame
ctx.drawImage(video, 0, 0);

// Load and draw skeleton
const frameData = await storageService.getWorkoutFrameData(workoutId);
const currentFrame = Math.floor(video.currentTime * 30); // 30fps assumed
const frame = frameData.frames[currentFrame];

poseAnalysisService.drawSkeleton(canvas, frame.landmarks, frame.errors);
```

### Frame Data Structure
```javascript
{
  time: 0.033, // seconds
  landmarks: [
    { x: 0.5, y: 0.3, z: 0.1, visibility: 0.95 },
    // ... 33 landmarks for full skeleton
  ],
  errors: [
    { 
      id: "knee_cave", 
      name: "Knee Caving", 
      severity: "high",
      affectedJoints: ["LEFT_KNEE", "RIGHT_KNEE"]
    }
  ],
  metrics: {
    depth: 0.85,
    balance: 0.92,
    alignment: 0.88
  }
}
```

### Rep Data Structure
```javascript
repProgressionAnalyses: [
  {
    repNumber: 1,
    phases: {
      descent: { duration: 1200, smooth: true },
      bottom: { duration: 400, control: 0.9 },
      ascent: { duration: 1000, smooth: true },
      top: { duration: 300, lockout: true }
    },
    quality: {
      smoothness: 85,
      symmetry: 92,
      controlledTempo: 88
    },
    issues: [
      { 
        name: "Incomplete Range of Motion",
        description: "Knees not reaching full depth",
        correction: "Lower further until hips are below knee level"
      }
    ]
  }
]
```

## Browser Compatibility

The feature uses:
- **IndexedDB**: Supported in all modern browsers
- **Canvas**: Supported in all modern browsers
- **HTMLMediaElement**: Supported in all modern browsers
- **Blob API**: Supported in all modern browsers

### Storage Limits
- IndexedDB: Typically 50MB+ per domain (browser dependent)
- Video storage: Depends on codec and duration
  - ~1.5MB per 10 seconds of 720p video

## Performance Considerations

### Memory Usage
- Frame data: ~50KB per frame (33 landmarks × 1600 frames = ~80MB)
- Video blob: Varies by codec (1-5MB per minute)
- Total per workout: 100-200MB for typical 5-minute workout

### Optimization Tips
1. **Adjust sampling rate**: Fewer frames = smaller data size
2. **Video compression**: Use H.264 codec for better compression
3. **Cleanup**: Delete old workouts to free storage
4. **IndexedDB quotas**: Browser may ask for permission for large storage

## Future Enhancements

Possible additions to this feature:
1. **Export workouts**: Download video with skeleton overlay
2. **Comparison mode**: Side-by-side replay of different workouts
3. **Rep templates**: Compare rep against ideal form template
4. **Progress tracking**: Automated metrics over time
5. **Cloud sync**: Upload workouts to server for backup
6. **Heatmaps**: Visualize where form breaks down across reps
7. **Video filters**: Adjust playback speed, brightness, skeleton opacity

## Troubleshooting

### Video not loading
- Check browser developer console for IndexedDB errors
- Ensure browser supports IndexedDB
- Check storage quota hasn't been exceeded

### Skeleton not showing
- Verify `drawSkeleton` method in `poseAnalysisService`
- Check frame data was saved correctly
- Ensure canvas is properly positioned over video

### Slow playback
- Reduce number of frames being stored
- Try different video codec
- Close other browser tabs to free memory

### Storage quota exceeded
- Delete old workouts
- Use browser storage settings to increase quota
- Export important workouts to file
