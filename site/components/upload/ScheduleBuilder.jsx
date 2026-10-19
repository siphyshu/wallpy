import { useState, useMemo } from 'react';
import { DocumentDuplicateIcon, ArrowDownTrayIcon, PlusIcon, PhotoIcon, SunIcon, DocumentTextIcon, CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
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
 * The schedule step: the builder for the pack's template and its schedule.toml,
 * side by side and both editable. Text the builder can show exactly flows into
 * the builder as you type; text it can't (options the builder doesn't have, or
 * a typo mid-edit) is kept as text, and the builder waits, dimmed, at its last
 * state. The Schedule Preview is exactly what's submitted, checked by the same
 * validator as the server; the Wallpack Preview keeps the last schedule that
 * worked, so it never blinks out while you edit.
 */
export default function ScheduleBuilder({ wallpackType, files, config, onConfigChange, metadata }) {
  const imageFiles = useMemo(() => files.filter(f => f.type.startsWith('image/')), [files]);
  const [copied, setCopied] = useState(false);
  // Raw text while the person is typing (so it isn't reformatted under the cursor).
  const [draft, setDraft] = useState(null);
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

  // Remember the last builder state and the last schedule worth previewing, so
  // neither disappears while the text has an error.
  const [lastBuilder, setLastBuilder] = useState(isText ? null : config);
  if (config && !isText && config !== lastBuilder) setLastBuilder(config);
  const usable = schedule && schedule.slot.length > 0 && schedule.slot.every((s) => (s.images?.length ?? 0) > 0);
  const [lastGood, setLastGood] = useState(usable ? schedule : null);
  if (usable && schedule !== lastGood) setLastGood(schedule);
  const shown = usable ? schedule : lastGood;

  const editText = (text) => {
    let parsed = null;
    try { parsed = configToSchedule(wallpackType, { mode: 'text', text }, meta); } catch { /* mid-edit */ }
    if (parsed && fitsBuilder(wallpackType, parsed)) {
      setDraft(text);
      onConfigChange(scheduleToConfig(wallpackType, parsed));
    } else {
      setDraft(null);
      onConfigChange({ mode: 'text', text });
    }
  };

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

  const builderConfig = isText ? lastBuilder : config;
  const builderProps = { scheduleConfig: builderConfig, imageFiles, onConfigChange };

  return (
    <div className="max-w-7xl mx-auto">
      {isText && (
        <div className="max-w-6xl mx-auto mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {schedule
            ? `This schedule uses options the ${TYPE_NAMES[wallpackType]} builder doesn't have, so it's kept as text. Edit it in the schedule.toml below; remove those options to use the builder again.`
            : 'The schedule.toml has an error. The builder will catch up as soon as it’s valid again.'}
        </div>
      )}
      {builderConfig && (
        <div inert={isText} className={isText ? 'opacity-40 transition-opacity' : 'transition-opacity'} aria-hidden={isText || undefined}>
          {wallpackType === 'daypack' && <DaypackBuilder {...builderProps} />}
          {wallpackType === 'weekpack' && <WeekpackBuilder {...builderProps} />}
          {wallpackType === 'album' && <AlbumBuilder {...builderProps} />}
        </div>
      )}

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
                {copied ? 'Copied' : 'Copy'}
              </button>
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
          <div className="bg-black/20 rounded-lg flex-1 flex flex-col overflow-x-auto overflow-y-auto scrollbar focus-within:ring-1 focus-within:ring-white/20">
            <textarea
              aria-label="schedule.toml"
              value={isText ? config.text : (draft ?? tomlString)}
              onChange={(e) => editText(e.target.value)}
              onBlur={() => setDraft(null)}
              spellCheck={false}
              className="flex-1 w-full min-h-[320px] text-white/80 text-sm font-mono p-4 rounded-lg outline-none border-none bg-transparent resize-none scrollbar"
            />
          </div>
          {tomlError ? (
            <p className="text-xs text-red-400 mt-2">{tomlError}</p>
          ) : (
            <p className="text-xs text-white/60 mt-2">
              This is the schedule.toml in your wallpack. Edit it here or with the builder; name and author come from the pack details.
            </p>
          )}
        </div>

        <div className="col-span-1 flex flex-col gap-8">
          {shown && (
            <div className="flex flex-col gap-2">
              {shown !== schedule && (
                <p className="text-xs text-amber-200/80">Showing the last version that worked while you fix the schedule.</p>
              )}
              {wallpackType === 'daypack' && <DayPreview schedule={shown} imageFiles={imageFiles} />}
              {wallpackType === 'weekpack' && <WeekPreview schedule={shown} imageFiles={imageFiles} />}
              {wallpackType === 'album' && <AlbumPreview schedule={shown} imageFiles={imageFiles} />}
            </div>
          )}
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
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    {wallpackType === 'daypack' && <PlusIcon className="w-5 h-5 text-white/70" />}
                    {wallpackType === 'weekpack' && <CalendarIcon className="w-5 h-5 text-white/70" />}
                    {wallpackType === 'album' && <PhotoIcon className="w-5 h-5 text-white/70" />}
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
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Add or remove blocks; click a block&apos;s name to rename it</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>A block runs from its start until the next block starts (the last one runs overnight)</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Blocks are always listed in the order they start; two can&apos;t start at the same time</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'weekpack' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Group days that share wallpapers: one per day, weekdays + weekend, or your own mix</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Each day belongs to exactly one group, and every day needs one</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Click a day to move it in or out of a group</p>
                      </div>
                    </>
                  )}
                  {wallpackType === 'album' && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Click images from the available panel to add them to your album</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Drag images to reorder them in your album</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                        <p>Use &quot;Add All&quot; to quickly include all uploaded images</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Image Assignment */}
              <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 text-white/70" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Image Assignment</h4>
                    <p className="text-sm text-white/60">Drag, drop, and organize your wallpapers</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Drag images from the left panel or use multi-select for bulk operations</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Reorder images by dragging them to new positions</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-white/40 rounded-full mt-2 flex-shrink-0"></div>
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
                    <p>Edit schedule.toml directly for options the builder doesn&apos;t have, or load a spec 2 file</p>
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