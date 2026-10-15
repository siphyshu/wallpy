import { useState, useEffect } from 'react';
import { PlayIcon, PauseIcon, ArrowPathIcon, ForwardIcon, BackwardIcon } from '@heroicons/react/24/outline';

export default function AlbumPreview({ scheduleConfig, imageFiles }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // seconds per image

  const albumImages = scheduleConfig?.album?.images || [];
  const currentImageName = albumImages[currentIndex];
  const currentImageFile = imageFiles.find(f => f.name === currentImageName);

  // Playback effect
  useEffect(() => {
    let interval;
    if (isPlaying && albumImages.length > 0) {
      interval = setInterval(() => {
        if (scheduleConfig?.album?.shuffle) {
          // Random next image
          const randomIndex = Math.floor(Math.random() * albumImages.length);
          setCurrentIndex(randomIndex);
        } else {
          // Sequential
          setCurrentIndex(prev => (prev + 1) % albumImages.length);
        }
      }, playbackSpeed * 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, albumImages.length, scheduleConfig?.album?.shuffle]);

  // Reset index when album changes
  useEffect(() => {
    if (currentIndex >= albumImages.length) {
      setCurrentIndex(0);
    }
  }, [albumImages.length, currentIndex]);

  const togglePlayback = () => setIsPlaying(!isPlaying);
  
  const reset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const nextImage = () => {
    if (scheduleConfig?.album?.shuffle) {
      const randomIndex = Math.floor(Math.random() * albumImages.length);
      setCurrentIndex(randomIndex);
    } else {
      setCurrentIndex(prev => (prev + 1) % albumImages.length);
    }
  };

  const prevImage = () => {
    setCurrentIndex(prev => (prev - 1 + albumImages.length) % albumImages.length);
  };

  return (
    <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Album Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={prevImage}
            disabled={albumImages.length === 0}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous"
          >
            <BackwardIcon className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlayback}
            disabled={albumImages.length === 0}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={nextImage}
            disabled={albumImages.length === 0}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next"
          >
            <ForwardIcon className="w-4 h-4" />
          </button>
          <button
            onClick={reset}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20"
            title="Reset"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Preview */}
      <div className="mb-6">
        {currentImageFile ? (
          <div className="relative aspect-[16/9] bg-black/10 rounded-xl overflow-hidden w-full">
            <img
              src={currentImageFile.preview}
              alt={currentImageFile.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-black/10 rounded-xl flex items-center justify-center border-2 border-dashed border-white/20">
            <p className="text-white/40 text-sm">
              {albumImages.length === 0 ? 'No images in album' : 'Image not found'}
            </p>
          </div>
        )}
        {currentImageFile && (
          <p className="text-xs text-white/60 truncate text-center mt-2">{currentImageFile.name}</p>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-white mb-1">
          {albumImages.length > 0 ? `${currentIndex + 1} / ${albumImages.length}` : '0 / 0'}
        </div>
        <div className="text-sm text-white/60">
          {scheduleConfig?.album?.shuffle ? 'Shuffle enabled' : 'Sequential order'}
        </div>
      </div>

      {/* Progress Bar */}
      {albumImages.length > 0 && (
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-4">
          <div 
            className="bg-white h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / albumImages.length) * 100}%` }}
          />
        </div>
      )}

      {/* Playback Speed */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs text-white/60">Speed:</span>
        <div className="flex gap-1">
          {[1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                playbackSpeed === speed
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {speed}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

