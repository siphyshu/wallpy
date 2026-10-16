import { useState, useEffect, useRef, useMemo } from 'react';
import { DocumentDuplicateIcon, ArrowDownTrayIcon, PlusIcon, PhotoIcon, SunIcon, DocumentTextIcon, CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import DaypackBuilder from './DaypackBuilder';
import WeekpackBuilder from './WeekpackBuilder';
import AlbumBuilder from './AlbumBuilder';
import ScheduleUploader from './ScheduleUploader';
import DayPreview from './DayPreview';
import WeekPreview from './WeekPreview';
import AlbumPreview from './AlbumPreview';
import toml from '@iarna/toml';
import { builderToSchedule, scheduleToBuilder } from '@/lib/spec/builder';
import { validateSchedule } from '@/lib/spec/validate';

const daysOfWeek = [
  { id: 'monday', name: 'Monday', icon: '📅' },
  { id: 'tuesday', name: 'Tuesday', icon: '📅' },
  { id: 'wednesday', name: 'Wednesday', icon: '📅' },
  { id: 'thursday', name: 'Thursday', icon: '📅' },
  { id: 'friday', name: 'Friday', icon: '📅' },
  { id: 'saturday', name: 'Saturday', icon: '🎉' },
  { id: 'sunday', name: 'Sunday', icon: '😴' }
];
 
/** Starting point for each builder (the wizard creates it on entering the schedule step). */
export function defaultScheduleConfig(wallpackType, imageFiles) {
  const defaultConfig = {};
    if (wallpackType === 'daypack') {
      defaultConfig.timeblocks = {
        sunrise: {
          start: 'dawn',
          images: [],
          shuffle: false
        },
        day: {
          start: 'sunrise+30m',
          images: [],
          shuffle: false
        },
        sunset: {
          start: 'sunset-30m',
          images: [],
          shuffle: false
        },
        night: {
          start: 'dusk+30m',
          images: [],
          shuffle: false
        }
      };
    } else if (wallpackType === 'weekpack') {
      defaultConfig.days = {};
      daysOfWeek.forEach(day => {
        defaultConfig.days[day.id] = {
          images: [],
          shuffle: false
        };
      });
    } else if (wallpackType === 'album') {
      defaultConfig.album = {
        images: imageFiles.map(f => f.name),
        shuffle: false,
        interval: '1h'
      };
    }

  return defaultConfig;
}

export default function ScheduleBuilder({ wallpackType, files, config, onConfigChange, metadata }) {
  const scheduleConfig = config;
  const imageFiles = files.filter(f => f.type.startsWith('image/'));

  const updateConfig = (newConfig) => {
    onConfigChange(newConfig);
  };

  const renderDaypackBuilder = () => {
    return (
      <DaypackBuilder
        scheduleConfig={scheduleConfig}
        imageFiles={imageFiles}
        onConfigChange={updateConfig}
      />
    );
  };

  const renderWeekpackBuilder = () => (
    <WeekpackBuilder
      scheduleConfig={scheduleConfig}
      imageFiles={imageFiles}
      onConfigChange={updateConfig}
      daysOfWeek={daysOfWeek}
    />
  );

  const renderAlbumBuilder = () => {
    return (
      <AlbumBuilder
        scheduleConfig={scheduleConfig}
        imageFiles={imageFiles}
        onConfigChange={updateConfig}
      />
    );
  };

  const tomlRef = useRef(null);
  // Copied indication state
  const [copied, setCopied] = useState(false);


  // The schedule.toml the CLI will actually receive (pack spec 2), derived
  // from the builder state, plus the first problem the validator finds.
  const { tomlString, tomlError } = useMemo(() => {
    if (!scheduleConfig) return { tomlString: '', tomlError: '' };
    try {
      const schedule = builderToSchedule(wallpackType, scheduleConfig, {
        name: metadata?.title || 'Untitled',
        author: metadata?.isOriginal ? undefined : metadata?.authorName,
      });
      const problems = validateSchedule(schedule, imageFiles.map((f) => f.name));
      return { tomlString: toml.stringify(schedule), tomlError: problems[0] ?? '' };
    } catch {
      return { tomlString: '# Error converting to TOML', tomlError: '' };
    }
  }, [scheduleConfig, wallpackType, metadata, imageFiles]);

  const handleCopy = () => {
    if (tomlRef.current) {
      tomlRef.current.select();
      document.execCommand('copy');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(tomlString);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([tomlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.toml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!scheduleConfig) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/60">Loading schedule builder...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {wallpackType === 'daypack' && renderDaypackBuilder()}
      {wallpackType === 'weekpack' && renderWeekpackBuilder()}
      {wallpackType === 'album' && renderAlbumBuilder()}

      {/* Schedule Preview, Upload, and Day Preview */}
      <div className="max-w-6xl mx-auto mt-8 grid lg:grid-cols-3 gap-8">
        
        {/* Schedule Preview */}
        <div className="col-span-2 bg-white/5 rounded-lg p-6 border border-white/10 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Schedule Preview</h3>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors flex items-center gap-2"
                title="Copy TOML"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                Copy
              </button>
              {copied && <span className="text-xs text-green-400 ml-1">Copied!</span>}
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors flex items-center gap-2"
                title="Download TOML"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
          <div className="bg-black/20 rounded-lg flex-1 flex flex-col overflow-x-auto overflow-y-auto scrollbar">
            <pre className="flex-1 w-full text-green-400 text-sm font-mono p-4 rounded-lg outline-none border-none bg-transparent overflow-x-auto overflow-y-auto scrollbar">
              <code>{tomlString}</code>
            </pre>
          </div>
          <p className="text-xs text-white/60 mt-2">
            This configuration will be saved as schedule.toml in your wallpack
          </p>
        </div>
        
        <div className="col-span-1 flex flex-col gap-8">
          {/* Day Preview */}
          {wallpackType === 'daypack' && (
            <DayPreview
              scheduleConfig={scheduleConfig}
              imageFiles={imageFiles}
            />
          )}

          {/* Week Preview */}
          {wallpackType === 'weekpack' && (
            <WeekPreview
              scheduleConfig={scheduleConfig}
              imageFiles={imageFiles}
            />
          )}

          {/* Album Preview */}
          {wallpackType === 'album' && (
            <AlbumPreview
              scheduleConfig={scheduleConfig}
              imageFiles={imageFiles}
            />
          )}

          {/* Schedule Uploader */}
          {(wallpackType === 'daypack' || wallpackType === 'weekpack' || wallpackType === 'album') && (
            <ScheduleUploader
              onConfigChange={updateConfig}
              currentConfig={scheduleConfig}
              wallpackType={wallpackType}
            />
          )}
        </div>
      </div>

      {/* Configuration Guide */}
      <div id="configuration-guide" className="max-w-6xl mx-auto mt-8">
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold mb-2">Configuration Guide</h3>
            <p className="text-white/70">
              {wallpackType === 'daypack' && 'Everything you need to know about setting up your daypack'}
              {wallpackType === 'weekpack' && 'Everything you need to know about setting up your weekpack'}
              {wallpackType === 'album' && 'Everything you need to know about setting up your album'}
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Structure Management */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    {wallpackType === 'daypack' && <PlusIcon className="w-5 h-5 text-blue-400" />}
                    {wallpackType === 'weekpack' && <CalendarIcon className="w-5 h-5 text-blue-400" />}
                    {wallpackType === 'album' && <PhotoIcon className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">
                      {wallpackType === 'daypack' && 'Time Block Management'}
                      {wallpackType === 'weekpack' && 'Day Management'}
                      {wallpackType === 'album' && 'Album Organization'}
                    </h4>
                    <p className="text-sm text-white/60">
                      {wallpackType === 'daypack' && 'Create and organize your daypack structure'}
                      {wallpackType === 'weekpack' && 'Assign images to days of the week'}
                      {wallpackType === 'album' && 'Organize your image collection'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  {wallpackType === 'daypack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Add or remove timeblocks and rename by clicking on block names</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Each block represents a time period with its own image collection</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Ensure time blocks do not overlap and have unique names</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'weekpack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Each day of the week can have its own set of wallpapers</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Wallpapers automatically change when the day changes</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Days without images will be skipped in the rotation</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'album' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Click images from the available panel to add them to your album</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Drag images to reorder them in your album</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Use &quot;Add All&quot; to quickly include all uploaded images</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Image Assignment */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Image Assignment</h4>
                    <p className="text-sm text-white/60">Drag, drop, and organize your wallpapers</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Drag images from the left panel or use multi-select for bulk operations</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Reorder images by dragging them to new positions</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Use the shuffle toggle to randomize image order</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div className="space-y-6">
              {/* Type-specific Configuration */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    {wallpackType === 'daypack' && <SunIcon className="w-5 h-5 text-orange-400" />}
                    {wallpackType === 'weekpack' && <CalendarIcon className="w-5 h-5 text-orange-400" />}
                    {wallpackType === 'album' && <ArrowPathIcon className="w-5 h-5 text-orange-400" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">
                      {wallpackType === 'daypack' && 'Time Configuration'}
                      {wallpackType === 'weekpack' && 'Weekly Schedule'}
                      {wallpackType === 'album' && 'Rotation Settings'}
                    </h4>
                    <p className="text-sm text-white/60">
                      {wallpackType === 'daypack' && 'Set start and end times for each block'}
                      {wallpackType === 'weekpack' && 'How the weekly rotation works'}
                      {wallpackType === 'album' && 'Control how images cycle'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  {wallpackType === 'daypack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Use solar events: <span className="font-mono text-orange-300">dawn</span>, <span className="font-mono text-orange-300">sunrise</span>, <span className="font-mono text-orange-300">noon</span>, <span className="font-mono text-orange-300">sunset</span>, <span className="font-mono text-orange-300">dusk</span>, <span className="font-mono text-orange-300">midnight</span></p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Add offsets: <span className="font-mono text-orange-300">dawn+15m</span>, <span className="font-mono text-orange-300">sunset-30m</span></p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Or use 24h format: <span className="font-mono text-orange-300">12:00</span>, <span className="font-mono text-orange-300">14:30</span></p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'weekpack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Wallpapers change at midnight when the day changes</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Multiple images per day will rotate throughout the day</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Enable shuffle for random order within each day</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'album' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>With shuffle off, images cycle in the order you arranged them</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Enable shuffle to randomize the rotation order</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Choose how often the image changes, from 15 minutes to a day</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Preview & Export */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <DocumentTextIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Preview & Export</h4>
                    <p className="text-sm text-white/60">Review and save your configuration</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      {wallpackType === 'daypack' && 'Preview your daypack throughout the day'}
                      {wallpackType === 'weekpack' && 'Preview your weekpack across all days'}
                      {wallpackType === 'album' && 'Preview your album collection'}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Review the generated <span className="font-mono text-purple-300">schedule.toml</span> file</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Upload existing configurations using the file uploader</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}