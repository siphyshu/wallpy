import { useState, useEffect, useMemo } from 'react';
import { active } from '@/lib/spec/scheduler';
import { fallbackMinutes } from '@/lib/spec/time';
import { PlayIcon, PauseIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

/** Scrub through a day with the real scheduler. `schedule` is the spec 2 schedule being built. */
export default function DayPreview({ schedule, imageFiles }) {
  // Store current time as minute index (0-1439)
  const [currentMinute, setCurrentMinute] = useState(360); // 6 AM = 360
  const [isPlaying, setIsPlaying] = useState(false);
  // 1x = 10min/s, 5x = 50min/s, 10x = 100min/s
  const [playbackSpeed, setPlaybackSpeed] = useState(5); // Default 5x (50min/s)
  const [currentBlock, setCurrentBlock] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);

  // The preview runs the real scheduler (lib/spec, the same rules as the CLI)
  // on today's date at the fallback solar times.
  const timeline = useMemo(() => schedule.slot.map((slot, i) => {
    const next = schedule.slot[(i + 1) % schedule.slot.length];
    let start = null;
    let end = null;
    try { start = fallbackMinutes(slot.at ?? '00:00'); } catch {}
    try { end = fallbackMinutes(next.at ?? '00:00'); } catch {}
    return { name: slot.label ?? `Block ${i + 1}`, at: slot.at ?? '00:00', nextAt: next.at ?? '00:00', start, end, slot };
  }), [schedule]);

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

  const blockInfo = timeline.find((b) => b.name === currentBlock) ?? null;

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

  // Every block needs an image before there's anything to preview.
  const usable = schedule.slot.length > 0 && schedule.slot.every((s) => s.images.length > 0);

  // Ask the scheduler which image shows at the chosen minute.
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const instant = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + currentMinute * 60_000;
    if (!usable) return;
    active(schedule, instant, 'UTC', null)
      .then((a) => {
        if (cancelled) return;
        setCurrentBlock(timeline[a.slot]?.name ?? null);
        setCurrentImage(a.image);
      })
      .catch(() => {
        if (!cancelled) { setCurrentBlock(null); setCurrentImage(null); }
      });
    return () => { cancelled = true; };
  }, [currentMinute, schedule, timeline, usable]);

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

  const currentImageFile = usable ? imageFiles.find(f => f.name === currentImage) : null;

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
          {timeline.map((block) => {
            const isActive = currentBlock === block.name;
            return (
              <div key={block.name} className={`grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 p-4 rounded-lg transition-colors ${
                  isActive ? 'bg-white/10 border border-white/20' : 'bg-white/5'
                }`}>
                  {/* Start Time */}
                  <div className="text-xs text-white/60 flex flex-col items-start gap-0 min-w-0">
                    <span>{block.start === null ? '--:--' : formatTime(((block.start % 1440) + 1440) % 1440)}</span>
                    {isSolarEvent(block.at) && (
                      <span className="text-[10px] text-white/40 mt-0.5 truncate max-w-full" title={block.at}>({block.at})</span>
                    )}
                  </div>
                  {/* Block Name and Details */}
                  <div className="flex flex-col items-center min-w-0">
                    <div className="text-sm font-medium text-white truncate">{block.name}</div>
                    <div className="text-xs text-white/60 truncate max-w-full">
                      {block.slot.images.length} {block.slot.images.length === 1 ? 'image' : 'images'}{block.slot.images.length > 1 ? ` • ${block.slot.rotate?.startsWith('every ') ? block.slot.rotate : 'across the block'}${block.slot.shuffle ? ', shuffled' : ''}` : ''}
                    </div>
                  </div>
                  {/* Ends when the next block starts */}
                  <div className="text-xs text-white/60 flex flex-col items-end gap-0 min-w-0">
                    <span>{block.end === null ? '--:--' : formatTime(((block.end % 1440) + 1440) % 1440)}</span>
                    {isSolarEvent(block.nextAt) && (
                      <span className="text-[10px] text-white/40 mt-0.5 truncate max-w-full" title={block.nextAt}>({block.nextAt})</span>
                    )}
                  </div>
                </div>
            );
          })}
        </div>
        <div className="text-xs text-white/50 mt-4 text-center">
          Times shown at typical solar times; on your computer they follow your location&apos;s real sunrise and sunset.
        </div>
      </div>
    </div>
  );
} 