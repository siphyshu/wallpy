import { useState, useEffect } from 'react';
import { PlayIcon, PauseIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function DayPreview({ scheduleConfig, imageFiles }) {
  // Store current time as minute index (0-1439)
  const [currentMinute, setCurrentMinute] = useState(360); // 6 AM = 360
  const [isPlaying, setIsPlaying] = useState(false);
  // 1x = 10min/s, 5x = 50min/s, 10x = 100min/s
  const [playbackSpeed, setPlaybackSpeed] = useState(5); // Default 5x (50min/s)
  const [currentBlock, setCurrentBlock] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);

  // Parse time string to minutes (0-1439)
  const parseTime = (timeStr) => {
    // Handle absolute time format (e.g., "12:00", "14:30")
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }
    
    // Handle solar events with offsets
    const solarWithOffset = timeStr.match(/^(midnight|dawn|sunrise|noon|sunset|dusk)([+-]\d+m)$/);
    if (solarWithOffset) {
      const [, event, offset] = solarWithOffset;
      const baseTime = getSolarEventTime(event);
      const offsetMinutes = parseInt(offset);
      return baseTime + offsetMinutes;
    }
    
    // Handle solar events only
    return getSolarEventTime(timeStr);
  };

  // Get approximate time for solar events (in minutes)
  const getSolarEventTime = (event) => {
    const solarTimes = {
      midnight: 0,
      dawn: 330,      // 5.5 * 60
      sunrise: 390,   // 6.5 * 60
      noon: 720,      // 12 * 60
      sunset: 1110,   // 18.5 * 60
      dusk: 1170      // 19.5 * 60
    };
    return solarTimes[event] || 720;
  };

  // Get current time block and image
  const getCurrentState = (minute) => {
    if (!scheduleConfig.timeblocks) return { block: null, image: null };
    
    const blocks = Object.entries(scheduleConfig.timeblocks);
    
    for (const [blockName, block] of blocks) {
      const startTime = parseTime(block.start);
      const endTime = parseTime(block.end);
      // Handle overnight blocks (e.g., sunset to sunrise)
      let isActive = false;
      if (endTime < startTime) {
        // Overnight block
        isActive = minute >= startTime || minute < endTime;
      } else {
        // Normal block
        isActive = minute >= startTime && minute < endTime;
      }
      if (isActive && block.images.length > 0) {
        // Determine which image to show
        let imageIndex = 0;
        if (block.shuffle) {
          // For shuffle, use time-based pseudo-random selection
          const seed = minute + blockName.length;
          imageIndex = seed % block.images.length;
        } else {
          // For sequential, cycle through images based on time
          const timeInBlock = endTime < startTime 
            ? (minute >= startTime ? minute - startTime : minute + (1440 - startTime))
            : minute - startTime;
          const cycleDuration = (endTime < startTime ? (1440 - startTime) + endTime : endTime - startTime) / block.images.length;
          imageIndex = Math.floor(timeInBlock / cycleDuration) % block.images.length;
        }
        return {
          block: blockName,
          image: block.images[imageIndex]
        };
      }
    }
    
    return { block: null, image: null };
  };

  // Format time for display
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Check if a time string is a solar event
  const isSolarEvent = (timeStr) => {
    const events = ['midnight', 'dawn', 'sunrise', 'noon', 'sunset', 'dusk'];
    if (!timeStr) return false;
    if (events.some(e => timeStr.startsWith(e))) return true;
    return false;
  };

  // Get time block info
  const getTimeBlockInfo = (blockName) => {
    if (!blockName || !scheduleConfig.timeblocks[blockName]) return null;
    const block = scheduleConfig.timeblocks[blockName];
    return {
      name: blockName,
      start: block.start,
      end: block.end,
      imageCount: block.images.length,
      shuffle: block.shuffle
    };
  };

  // Playback controls
  useEffect(() => {
    let interval;
    if (isPlaying) {
      // 1x = 10min/s (100ms per step), 5x = 50min/s (20ms), 10x = 100min/s (10ms)
      let msPerStep = playbackSpeed === 1 ? 100 : playbackSpeed === 5 ? 20 : 10;
      interval = setInterval(() => {
        setCurrentMinute(prev => {
          let newMinute = prev + 1;
          if (newMinute >= 1440) newMinute = 0;
          return newMinute;
        });
      }, msPerStep);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Update current state when time changes
  useEffect(() => {
    const state = getCurrentState(currentMinute);
    setCurrentBlock(state.block);
    setCurrentImage(state.image);
  }, [currentMinute, scheduleConfig]);

  const togglePlayback = () => setIsPlaying(!isPlaying);
  const resetTime = () => setCurrentMinute(360);
  const setTime = (minute) => setCurrentMinute(minute);

  // Scrubbing: animate through each minute between previous and new value
  const handleSliderScrub = (newValue) => {
    const prev = currentMinute;
    if (Math.abs(newValue - prev) < 1e-4) {
      setCurrentMinute(newValue);
      return;
    }
    const step = newValue > prev ? 1 : -1;
    let t = prev;
    const animate = () => {
      if ((step > 0 && t >= newValue) || (step < 0 && t <= newValue)) {
        setCurrentMinute(newValue);
        return;
      }
      t += step;
      setCurrentMinute(Number(t.toFixed(4)));
      setTimeout(animate, 1);
    };
    animate();
  };

  const blockInfo = getTimeBlockInfo(currentBlock);
  const currentImageFile = imageFiles.find(f => f.name === currentImage);

  return (
    <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Wallpack Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayback}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={resetTime}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors border border-white/20"
            title="Reset to 6 AM"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Big Wallpaper Card */}
      <div className="mb-6">
        {currentImageFile ? (
          <div className="aspect-[16/9] bg-black/10 rounded-xl overflow-hidden w-full max-w-3xl mx-auto shadow-lg">
            <img
              src={currentImageFile.preview}
              alt={currentImageFile.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-black/10 rounded-xl flex items-center justify-center border-2 border-dashed border-white/20 w-full max-w-3xl mx-auto">
            <p className="text-white/40 text-lg">No wallpaper active</p>
          </div>
        )}
        {currentImageFile && (
          <p className="text-xs text-white/60 truncate text-center mt-2">{currentImageFile.name}</p>
        )}
      </div>

      {/* Time Display */}
      <div className="text-center mb-6">
        <div className="text-3xl font-mono font-bold text-white mb-2">
          {formatTime(currentMinute)}
        </div>
        <div className="text-base text-white/70">
          {currentMinute < 360 ? 'Early Morning' : 
           currentMinute < 720 ? 'Morning' : 
           currentMinute < 1020 ? 'Afternoon' : 
           currentMinute < 1200 ? 'Evening' : 'Night'}
        </div>
      </div>

      {/* Time Slider */}
      <div className="mb-2">
        <input
          type="range"
          min="0"
          max="1439"
          step="1"
          value={currentMinute}
          onChange={(e) => setTime(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Playback Speed */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-white/60">Speed:</span>
        <div className="flex gap-1">
          {[1, 5, 10].map(speed => (
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
        <span className="text-xs text-white/40">(1s = {playbackSpeed === 1 ? '10' : playbackSpeed === 5 ? '50' : '100'} min)</span>
      </div>

      {/* Time Block Timeline */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-white/80 mb-3">Time Block Timeline</h4>
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 scrollbar">
          {Object.entries(scheduleConfig.timeblocks || {}).map(([blockName, block]) => {
            const startTime = parseTime(block.start);
            const endTime = parseTime(block.end);
            const isActive = currentBlock === blockName;
            return (
              <div key={blockName} className={`grid grid-cols-3 items-center gap-3 p-4 rounded-lg transition-colors ${
                  isActive ? 'bg-white/10 border border-white/20' : 'bg-white/5'
                }`}>
                  {/* Start Time */}
                  <div className="text-xs text-white/60 flex flex-col items-start gap-0">
                    <span>{formatTime(startTime)}</span>
                    {isSolarEvent(block.start) && (
                      <span key={blockName + '-start'} className="text-[10px] text-white/40 mt-0.5">({block.start})</span>
                    )}
                  </div>
                  {/* Block Name and Details */}
                  <div className="flex flex-col items-center min-w-0">
                    <div className="text-sm font-medium text-white truncate">{blockName}</div>
                    <div className="text-xs text-white/60 truncate">
                      {block.images.length} images • {block.shuffle ? 'Shuffle' : 'Sequential'}
                    </div>
                  </div>
                  {/* End Time */}
                  <div className="text-xs text-white/60 flex flex-col items-end gap-0">
                    <span>{formatTime(endTime)}</span>
                    {isSolarEvent(block.end) && (
                      <span key={blockName + '-end'} className="text-[10px] text-white/40 mt-0.5">({block.end})</span>
                    )}
                  </div>
                </div>
            );
          })}
        </div>
        <div className="text-xs text-white/50 mt-4 text-center">
          Note: Solar event times will vary based on your location.
        </div>
      </div>
    </div>
  );
} 