import { useState, useEffect } from 'react';
import { PlayIcon, PauseIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const daysOfWeek = [
  { id: 'monday', name: 'Monday', short: 'Mon' },
  { id: 'tuesday', name: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', name: 'Wednesday', short: 'Wed' },
  { id: 'thursday', name: 'Thursday', short: 'Thu' },
  { id: 'friday', name: 'Friday', short: 'Fri' },
  { id: 'saturday', name: 'Saturday', short: 'Sat' },
  { id: 'sunday', name: 'Sunday', short: 'Sun' }
];

export default function WeekPreview({ scheduleConfig, imageFiles }) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1 = 1 day/sec, 2 = 2 days/sec

  const currentDay = daysOfWeek[currentDayIndex];
  const dayConfig = scheduleConfig?.days?.[currentDay.id] || { images: [], shuffle: false };
  const dayImages = dayConfig.images || [];
  
  // Get the current image file
  const currentImageName = dayImages[currentImageIndex];
  const currentImageFile = imageFiles.find(f => f.name === currentImageName);

  // Playback effect - cycles through days
  useEffect(() => {
    let interval;
    if (isPlaying) {
      const msPerDay = 1000 / playbackSpeed;
      interval = setInterval(() => {
        setCurrentDayIndex(prev => (prev + 1) % 7);
        setCurrentImageIndex(0); // Reset to first image when day changes
      }, msPerDay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const togglePlayback = () => setIsPlaying(!isPlaying);
  
  const resetToMonday = () => {
    setCurrentDayIndex(0);
    setCurrentImageIndex(0);
    setIsPlaying(false);
  };

  const selectDay = (index) => {
    setCurrentDayIndex(index);
    setCurrentImageIndex(0); // a new day starts at its first image
    setIsPlaying(false);
  };

  const nextImage = () => {
    if (dayImages.length > 1) {
      setCurrentImageIndex(prev => (prev + 1) % dayImages.length);
    }
  };

  const prevImage = () => {
    if (dayImages.length > 1) {
      setCurrentImageIndex(prev => (prev - 1 + dayImages.length) % dayImages.length);
    }
  };

  // Get image count for a day
  const getImageCount = (dayId) => {
    return scheduleConfig?.days?.[dayId]?.images?.length || 0;
  };

  return (
    <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Weekpack Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayback}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={resetToMonday}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20"
            title="Reset to Monday"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Wallpaper Preview */}
      <div className="mb-6">
        {currentImageFile ? (
          <div className="relative aspect-[16/9] bg-black/10 rounded-xl overflow-hidden w-full">
            <img
              src={currentImageFile.preview}
              alt={currentImageFile.name}
              className="w-full h-full object-cover"
            />
            {/* Image navigation for days with multiple images */}
            {dayImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/60 rounded-full text-xs text-white">
                  {currentImageIndex + 1} / {dayImages.length}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="aspect-[16/9] bg-black/10 rounded-xl flex items-center justify-center border-2 border-dashed border-white/20">
            <p className="text-white/40 text-sm">No images for {currentDay.name}</p>
          </div>
        )}
        {currentImageFile && (
          <p className="text-xs text-white/60 truncate text-center mt-2">{currentImageFile.name}</p>
        )}
      </div>

      {/* Current Day Display */}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-white mb-1">
          {currentDay.name}
        </div>
        <div className="text-sm text-white/60">
          {dayImages.length} {dayImages.length === 1 ? 'image' : 'images'}
          {dayConfig.shuffle && ' • Shuffle enabled'}
        </div>
      </div>

      {/* Day Selector */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {daysOfWeek.map((day, index) => {
          const imageCount = getImageCount(day.id);
          const isActive = index === currentDayIndex;
          const hasImages = imageCount > 0;
          
          return (
            <button
              key={day.id}
              onClick={() => selectDay(index)}
              className={`relative p-2 rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-white text-black'
                  : hasImages
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-white/5 text-white/40'
              }`}
            >
              <div className="text-xs font-medium">{day.short}</div>
              <div className={`text-[10px] mt-0.5 ${isActive ? 'text-black/60' : 'text-white/50'}`}>
                {imageCount}
              </div>
            </button>
          );
        })}
      </div>

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
              {speed}x
            </button>
          ))}
        </div>
        <span className="text-xs text-white/40">(1 day = {(1000 / playbackSpeed / 1000).toFixed(1)}s)</span>
      </div>
    </div>
  );
}

