// Video Processing Utilities

export const extractFramesFromVideo = async (videoUrl, frameInterval = 0.5) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    video.onerror = () => reject(new Error('Failed to load video'));

    video.onloadeddata = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const frames = [];
        const duration = video.duration;

        // Extract frames with optimized event handling
        for (let time = 0; time < duration; time += frameInterval) {
          video.currentTime = time;
          
          // Use once event listener for better performance and cleanup
          await new Promise(resolve => {
            video.addEventListener('seeked', resolve, { once: true });
          });

          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Use lower quality JPEG for faster encoding
          frames.push({
            time,
            imageData,
            dataUrl: canvas.toDataURL('image/jpeg', 0.7)
          });
        }

        resolve({
          frames,
          duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      } catch (error) {
        reject(error);
      }
    };
  });
};

export const getVideoMetadata = (videoUrl) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'metadata';

    video.onerror = () => reject(new Error('Failed to load video'));

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
  });
};

export const captureVideoFrame = async (video, canvas = null) => {
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  return {
    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    dataUrl: canvas.toDataURL('image/jpeg', 0.8)
  };
};

export const createVideoFromFrames = async (frames, fps = 30) => {
  // This would require a more complex implementation with libraries like ffmpeg.wasm
  // For now, we'll just return a placeholder
  console.log('Video creation from frames not yet implemented');
  return null;
};
