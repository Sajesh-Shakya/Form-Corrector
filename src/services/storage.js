// Storage Service - handles all data persistence with IndexedDB for large data
// Uses localStorage for metadata and IndexedDB for videos/frame data

const STORAGE_KEYS = {
  WORKOUTS: 'exercise_form_workouts',
  USER_PROFILE: 'exercise_form_user_profile',
  EXERCISE_STATS: 'exercise_form_stats'
};

const DB_NAME = 'ExerciseFormAdvisor';
const DB_VERSION = 1;

// Helper to detect quota errors
const isQuotaError = (error) => {
  return (
    error?.name === 'QuotaExceededError' ||
    error?.message?.includes('quota') ||
    error?.message?.includes('Quota') ||
    error?.code === 22 || // Legacy quota error code
    error?.code === 1014 // Firefox quota error
  );
};

class StorageService {
  constructor() {
    this.db = null;
    this.initDB();
  }

  /**
   * Initialize IndexedDB for storing large video/frame data
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store workout frame data and analysis
        if (!db.objectStoreNames.contains('workoutFrames')) {
          const frameStore = db.createObjectStore('workoutFrames', { keyPath: 'id', autoIncrement: true });
          frameStore.createIndex('workoutId', 'workoutId', { unique: false });
          frameStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store high-res video blobs
        if (!db.objectStoreNames.contains('videos')) {
          const videoStore = db.createObjectStore('videos', { keyPath: 'workoutId', unique: true });
          videoStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store analysis metadata
        if (!db.objectStoreNames.contains('analyses')) {
          const analysisStore = db.createObjectStore('analyses', { keyPath: 'workoutId', unique: true });
          analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Estimate storage usage
   */
  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
      };
    }
    return { used: 0, quota: 0, percentUsed: 0 };
  }

  /**
   * Get count of stored workouts with video/frame data
   */
  async getStoredWorkoutCount() {
    if (!this.db) await this.initDB();
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  /**
   * Delete oldest workout data to free up space
   */
  async deleteOldestWorkoutData(count = 1) {
    if (!this.db) await this.initDB();
    
    const workouts = this.getAllWorkouts()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(0, count);

    for (const workout of workouts) {
      await this.deleteWorkoutData(workout.id);
      console.log(`Deleted old workout data: ${workout.id}`);
    }
    
    return workouts.length;
  }

  /**
   * Clear all IndexedDB data (videos, frames, analyses) but keep workout metadata
   */
  async clearAllIndexedDBData() {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['workoutFrames', 'videos', 'analyses'],
        'readwrite'
      );

      transaction.objectStore('workoutFrames').clear();
      transaction.objectStore('videos').clear();
      transaction.objectStore('analyses').clear();

      transaction.oncomplete = () => {
        console.log('Cleared all IndexedDB data');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Save frame data for a workout (landmarks, errors, etc.)
   */
  async saveWorkoutFrameData(workoutId, frameData) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['workoutFrames'], 'readwrite');
      const store = transaction.objectStore('workoutFrames');

      const data = {
        workoutId,
        timestamp: new Date().toISOString(),
        frames: frameData  // Array of {time, landmarks, errors, dataUrl, metrics}
      };

      const request = store.add(data);
      request.onerror = () => {
        if (isQuotaError(request.error)) {
          reject(new Error('QUOTA_EXCEEDED: Storage is full. Please clear old workouts.'));
        } else {
          reject(request.error);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get frame data for a workout
   */
  async getWorkoutFrameData(workoutId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['workoutFrames'], 'readonly');
      const store = transaction.objectStore('workoutFrames');
      const index = store.index('workoutId');
      const request = index.get(workoutId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Save video blob for a workout
   */
  async saveVideoBlob(workoutId, videoBlob) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');

      const data = {
        workoutId,
        timestamp: new Date().toISOString(),
        blob: videoBlob,
        size: videoBlob.size
      };

      const request = store.put(data);
      request.onerror = () => {
        if (isQuotaError(request.error)) {
          reject(new Error('QUOTA_EXCEEDED: Storage is full. Please clear old workouts.'));
        } else {
          reject(request.error);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get video blob for a workout
   */
  async getVideoBlob(workoutId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readonly');
      const store = transaction.objectStore('videos');
      const request = store.get(workoutId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.blob);
    });
  }

  /**
   * Save analysis metadata (rep progression, consistency, etc.)
   */
  async saveAnalysisData(workoutId, analysisData) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['analyses'], 'readwrite');
      const store = transaction.objectStore('analyses');

      const data = {
        workoutId,
        timestamp: new Date().toISOString(),
        ...analysisData
      };

      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get analysis data for a workout
   */
  async getAnalysisData(workoutId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['analyses'], 'readonly');
      const store = transaction.objectStore('analyses');
      const request = store.get(workoutId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete all data for a workout
   */
  async deleteWorkoutData(workoutId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['workoutFrames', 'videos', 'analyses'],
        'readwrite'
      );

      // Delete from workoutFrames
      const frameStore = transaction.objectStore('workoutFrames');
      const frameIndex = frameStore.index('workoutId');
      frameIndex.openCursor(IDBKeyRange.only(workoutId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete from videos
      const videoStore = transaction.objectStore('videos');
      videoStore.delete(workoutId);

      // Delete from analyses
      const analysisStore = transaction.objectStore('analyses');
      analysisStore.delete(workoutId);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  // Workout history (localStorage)
  saveWorkout(workout) {
    const workouts = this.getAllWorkouts();
    const newWorkout = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...workout
    };
    workouts.push(newWorkout);
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
    return newWorkout;
  }

  getAllWorkouts() {
    const data = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return data ? JSON.parse(data) : [];
  }

  getWorkoutsByExercise(exerciseId) {
    return this.getAllWorkouts().filter(w => w.exerciseId === exerciseId);
  }

  getRecentWorkouts(limit = 10) {
    return this.getAllWorkouts()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getWorkout(workoutId) {
    return this.getAllWorkouts().find(w => w.id === workoutId);
  }

  deleteWorkout(workoutId) {
    const workouts = this.getAllWorkouts().filter(w => w.id !== workoutId);
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
  }

  // Exercise statistics
  getExerciseStats(exerciseId) {
    const allStats = this.getAllExerciseStats();
    return allStats[exerciseId] || {
      totalSessions: 0,
      averageScore: 0,
      commonErrors: {},
      bestScore: 0,
      lastWeight: 0,
      lastReps: 0
    };
  }

  getAllExerciseStats() {
    const data = localStorage.getItem(STORAGE_KEYS.EXERCISE_STATS);
    return data ? JSON.parse(data) : {};
  }

  updateExerciseStats(exerciseId, workout) {
    const allStats = this.getAllExerciseStats();
    const stats = allStats[exerciseId] || {
      totalSessions: 0,
      averageScore: 0,
      commonErrors: {},
      bestScore: 0,
      lastWeight: 0,
      lastReps: 0,
      scoreHistory: []
    };

    // Update stats
    stats.totalSessions += 1;
    stats.lastWeight = workout.weight || stats.lastWeight;
    stats.lastReps = workout.reps || stats.lastReps;
    stats.scoreHistory.push(workout.score);
    stats.averageScore = stats.scoreHistory.reduce((a, b) => a + b, 0) / stats.scoreHistory.length;
    stats.bestScore = Math.max(stats.bestScore, workout.score);

    // Track common errors
    if (workout.errors && Array.isArray(workout.errors)) {
      workout.errors.forEach(error => {
        if (!stats.commonErrors[error.id]) {
          stats.commonErrors[error.id] = {
            count: 0,
            name: error.name,
            correction: error.correction
          };
        }
        stats.commonErrors[error.id].count += 1;
      });
    }

    allStats[exerciseId] = stats;
    localStorage.setItem(STORAGE_KEYS.EXERCISE_STATS, JSON.stringify(allStats));
    return stats;
  }
  // User profile
  getUserProfile() {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : {
      name: '',
      goals: [],
      experience: 'beginner',
      preferences: {
        units: 'metric', // metric or imperial
        reminderTips: true
      }
    };
  }

  updateUserProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    return profile;
  }

  // Clear all data
  clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Export data (for backup)
  exportData() {
    return {
      workouts: this.getAllWorkouts(),
      stats: this.getAllExerciseStats(),
      profile: this.getUserProfile(),
      exportDate: new Date().toISOString()
    };
  }

  // Import data
  importData(data) {
    if (data.workouts) {
      localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(data.workouts));
    }
    if (data.stats) {
      localStorage.setItem(STORAGE_KEYS.EXERCISE_STATS, JSON.stringify(data.stats));
    }
    if (data.profile) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(data.profile));
    }
  }
}

export default new StorageService();
