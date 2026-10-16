import { useState, useMemo } from 'react';
import { DocumentDuplicateIcon, ArrowDownTrayIcon, PlusIcon, PhotoIcon, SunIcon, DocumentTextIcon, CalendarIcon, ArrowPathIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import DaypackBuilder from './DaypackBuilder';
import WeekpackBuilder from './WeekpackBuilder';
import AlbumBuilder from './AlbumBuilder';
import ScheduleUploader from './ScheduleUploader';
import DayPreview from './DayPreview';
import WeekPreview from './WeekPreview';
import AlbumPreview from './AlbumPreview';
import { configToSchedule, fitsBuilder, scheduleToConfig, scheduleToToml } from '@/lib/spec/builder';
import { validateSchedule } from '@/lib/spec/validate';

const TYPE_NAMES = { daypack: 'Daypack', weekpack: 'Weekpack', album: 'Album' };

/**
 * The schedule step: a builder for the pack's template, or (for schedules the
 * builder can't show) the schedule.toml as text. Either way the Schedule
 * Preview is exactly what's submitted, checked by the same validator as the server.
 */
export default function ScheduleBuilder({ wallpackType, files, config, onConfigChange, metadata }) {
  const imageFiles = useMemo(() => files.filter(f => f.type.startsWith('image/')), [files]);
  const [copied, setCopied] = useState(false);
  const meta = useMemo(() => ({
    name: metadata?.title || 'Untitled',
    author: metadata?.isOriginal ? undefined : metadata?.authorName,
  }), [metadata]);

  // The schedule.toml the CLI will receive, and the first problem with it.
  const { schedule, tomlString, tomlError } = useMemo(() => {
    if (!config) return { schedule: null, tomlString: '', tomlError: '' };
    try {
      const built = configToSchedule(wallpackType, config, meta);
      const problems = validateSchedule(built, imageFiles.map((f) => f.name));
      return { schedule: built, tomlString: config.mode === 'text' ? config.text : scheduleToToml(built), tomlError: problems[0] ?? '' };
    } catch (e) {
      return { schedule: null, tomlString: config.mode === 'text' ? config.text : '', tomlError: `Not valid TOML: ${e.message}` };
    }
  }, [config, wallpackType, meta, imageFiles]);

  const isText = config?.mode === 'text';
  const canUseBuilder = isText && schedule && fitsBuilder(wallpackType, schedule);

  const handleCopy = () => {
    navigator.clipboard?.writeText(tomlString);
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

  if (!config) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/60">Loading schedule builder...</p>
      </div>
    );
  }

  const builderProps = { scheduleConfig: config, imageFiles, onConfigChange };
  const previewable = schedule && schedule.slot.length > 0;

  return (
    <div className="max-w-7xl mx-auto">
      {isText ? (
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-serif font-bold mb-2 tracking-tight">Edit Schedule as Text</h2>
          <p className="text-white/70 text-lg mb-6">
            You&apos;re editing <span className="font-mono">schedule.toml</span> directly. The format is in the configuration guide below.
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1 text-left">
              {canUseBuilder
                ? `This schedule fits the ${TYPE_NAMES[wallpackType]} builder.`
                : `The ${TYPE_NAMES[wallpackType]} builder can't show this schedule${schedule ? ' (it uses options the builder doesn\u2019t have)' : ''}, so it stays as text.`}
            </p>
            <button
              onClick={() => onConfigChange(scheduleToConfig(wallpackType, schedule))}
              disabled={!canUseBuilder}
              className="shrink-0 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back to builder
            </button>
          </div>
        </div>
      ) : (
        <>
          {wallpackType === 'daypack' && <DaypackBuilder {...builderProps} />}
          {wallpackType === 'weekpack' && <WeekpackBuilder {...builderProps} />}
          {wallpackType === 'album' && <AlbumBuilder {...builderProps} />}
        </>
      )}

      {/* Schedule Preview, Upload, and Day Preview */}
      <div className="max-w-6xl mx-auto mt-8 grid lg:grid-cols-3 gap-8">

        {/* Schedule Preview */}
        <div className="col-span-2 bg-white/5 rounded-lg p-6 border border-white/10 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Schedule Preview</h3>
            <div className="flex gap-2 items-center">
              {!isText && (
                <button
                  onClick={() => onConfigChange({ mode: 'text', text: tomlString })}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors flex items-center gap-2"
                  title="Edit schedule.toml directly"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Edit as text
                </button>
              )}
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
            {isText ? (
              <textarea
                aria-label="schedule.toml"
                value={config.text}
                onChange={(e) => onConfigChange({ mode: 'text', text: e.target.value })}
                spellCheck={false}
                className="flex-1 w-full min-h-[320px] text-green-400 text-sm font-mono p-4 rounded-lg outline-none border-none bg-transparent resize-none scrollbar"
              />
            ) : (
              <pre className="flex-1 w-full text-green-400 text-sm font-mono p-4 rounded-lg outline-none border-none bg-transparent overflow-x-auto overflow-y-auto scrollbar">
                <code>{tomlString}</code>
              </pre>
            )}
          </div>
          {tomlError ? (
            <p className="text-xs text-red-400 mt-2">{tomlError}</p>
          ) : (
            <p className="text-xs text-white/60 mt-2">
              This is the schedule.toml in your wallpack{isText ? '. Name and author come from the pack details.' : ''}
            </p>
          )}
        </div>

        <div className="col-span-1 flex flex-col gap-8">
          {previewable && wallpackType === 'daypack' && <DayPreview schedule={schedule} imageFiles={imageFiles} />}
          {previewable && wallpackType === 'weekpack' && <WeekPreview schedule={schedule} imageFiles={imageFiles} />}
          {previewable && wallpackType === 'album' && <AlbumPreview schedule={schedule} imageFiles={imageFiles} />}
          <ScheduleUploader onConfigChange={onConfigChange} wallpackType={wallpackType} />
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
                        <p>Add or remove blocks; click a block&apos;s name to rename it</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>A block runs from its start until the next block starts (the last one runs overnight)</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Blocks are always listed in the order they start; two can&apos;t start at the same time</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'weekpack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Group days that share wallpapers: one per day, weekdays + weekend, or your own mix</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Each day belongs to exactly one group, and every day needs one</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Click a day to move it in or out of a group</p>
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
                    <p>Every uploaded image has to be used somewhere; the image list marks the ones that aren&apos;t</p>
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
                      {wallpackType === 'daypack' && 'When each block starts'}
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
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Several images in a block: split across the block, or changing every 15 min, hour, …</p>
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
                        <p>Several images share the day: split evenly, or changing every 15 min, hour, …</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Shuffle picks a new order each time, the same on every computer</p>
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
                        <p>Choose how often the image changes: a preset, or a custom interval from 5 minutes to 7 days</p>
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
                    <p>Load a spec 2 schedule.toml, or use &ldquo;Edit as text&rdquo; for options the builder doesn&apos;t have</p>
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