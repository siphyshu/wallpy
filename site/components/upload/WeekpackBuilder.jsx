import { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Shuffle } from 'lucide-react';
import ImagePool from './builder/ImagePool';
import SlotImages from './builder/SlotImages';
import DayPills from './builder/DayPills';
import RotateControl from './builder/RotateControl';
import { DAY_NAMES, describeDays, displayLabel, newSlotId, uncoveredDays, weekSlots } from '@/lib/spec/builder';

const PRESETS = [
  { id: 'each-day', label: 'One per day' },
  { id: 'weekdays-weekend', label: 'Weekdays + weekend' },
  { id: 'every-day', label: 'Same every day' },
];

/**
 * Weekpack: groups of days, each with its own images. A day belongs to one
 * group; every day needs one. Groups change at midnight.
 */
export default function WeekpackBuilder({ scheduleConfig, imageFiles, onConfigChange }) {
  const [editingId, setEditingId] = useState(null);
  const [overId, setOverId] = useState(null);
  const slots = scheduleConfig.slots;
  const setSlots = (next) => onConfigChange({ mode: 'builder', slots: next });
  const update = (id, patch) => setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const usage = new Map();
  slots.forEach((s) => s.images.forEach((n) => usage.set(n, (usage.get(n) ?? 0) + 1)));
  const names = slots.map((s, i) => displayLabel(s, 'weekpack', i));
  const missing = uncoveredDays(slots);

  // Switching layout keeps the images: each new group takes those of the old
  // group that had its first day.
  const applyPreset = (preset) => {
    const next = weekSlots(preset);
    for (const group of next) {
      const from = slots.find((s) => s.days?.includes(group.days[0]));
      if (from) Object.assign(group, { images: [...from.images], rotate: from.rotate, shuffle: from.shuffle });
    }
    setSlots(next);
  };
  const addGroup = () => setSlots([...slots, { id: newSlotId(), label: '', days: [...missing.slice(0, 1)], images: [], rotate: 'spread', shuffle: false }]);
  const autoAssign = () => {
    const per = Math.ceil(imageFiles.length / Math.max(slots.length, 1));
    setSlots(slots.map((s, i) => ({ ...s, images: imageFiles.slice(i * per, (i + 1) * per).map((f) => f.name) })));
  };
  const activePreset = PRESETS.find((p) => {
    const ref = weekSlots(p.id).map((s) => s.days.join());
    return ref.length === slots.length && ref.every((d, i) => d === (slots[i].days ?? []).join());
  })?.id;

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="sr-only">Configure Weekly Schedule</h2>
        <p className="text-white/70 max-w-2xl mx-auto mb-4">
          Group the days of the week and give each group its own images. Wallpapers change at midnight.
          <a href="#configuration-guide" className="underline text-white/70 hover:text-white ml-1">See the configuration guide for tips.</a>
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 mb-0">
        <div className="lg:col-span-1 max-h-[800px] overflow-y-auto">
          <ImagePool
            imageFiles={imageFiles}
            usage={usage}
            targetNoun="day group"
            targets={slots.map((s, i) => ({ id: s.id, label: names[i] }))}
            onAdd={(id, added) => update(id, { images: [...slots.find((s) => s.id === id).images, ...added] })}
          />
        </div>

        <div className="lg:col-span-2 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Day Groups
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{slots.length}</span>
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  aria-pressed={activePreset === p.id}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    activePreset === p.id ? 'bg-white text-black border-white' : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="flex-1" />
              <button
                onClick={addGroup}
                disabled={missing.length === 0}
                title={missing.length ? 'Add a group for a day that has none' : 'Every day is in a group; untick a day to make room'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-4 h-4" /> Add Group
              </button>
              <button onClick={autoAssign} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors" title="Share the images out across the groups, in order">
                <ArrowPathIcon className="w-4 h-4" /> Auto-assign Images
              </button>
            </div>
            {missing.length > 0 && (
              <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {missing.map((d) => DAY_NAMES[d]).join(', ')} {missing.length === 1 ? 'isn’t' : 'aren’t'} in any group yet. Every day needs one.
              </div>
            )}
            <hr className="my-4 border-white/10" />
            <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-y-auto scrollbar pr-2">
              {slots.map((group, index) => {
                const takenBy = new Map();
                slots.forEach((other, j) => { if (other.id !== group.id) (other.days ?? []).forEach((d) => takenBy.set(d, names[j])); });
                return (
                  <section
                    key={group.id}
                    aria-label={names[index]}
                    onDragEnter={() => setOverId(group.id)}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); }}
                    onDrop={() => setOverId(null)}
                    className={`bg-white/5 rounded-xl shadow-lg p-5 border-2 transition-all duration-300 ease-out relative group ${overId === group.id ? 'border-white/40 bg-white/10' : 'border-white/10 hover:bg-white/[0.07]'}`}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      {editingId === group.id ? (
                        <input
                          type="text"
                          value={group.label}
                          autoFocus
                          maxLength={32}
                          onChange={(e) => update(group.id, { label: e.target.value.replace(/[^A-Za-z0-9 _-]/g, '') })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEditingId(null); }}
                          placeholder={describeDays(group.days)}
                          className="text-lg font-bold bg-transparent border-b border-white/20 outline-none text-white px-1 py-0.5 w-40"
                        />
                      ) : (
                        <button className="text-lg font-bold text-white hover:underline truncate" onClick={() => setEditingId(group.id)} title="Rename group">
                          {names[index]}
                        </button>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => update(group.id, { shuffle: !group.shuffle })}
                          aria-pressed={group.shuffle}
                          className={`p-2 rounded-full border border-white/20 transition-colors ${group.shuffle ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          title={group.shuffle ? 'Shuffle on: images in a random order' : 'Shuffle off: images in this order'}
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                        {slots.length > 1 && (
                          <button
                            onClick={() => setSlots(slots.filter((s) => s.id !== group.id))}
                            className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors border border-white/20"
                            title="Remove group"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="block text-xs font-medium mb-1 text-white/60">Days</span>
                      <DayPills value={group.days ?? []} takenBy={takenBy} onChange={(days) => update(group.id, { days })} />
                      {(group.days ?? []).length === 0 && <p className="text-xs text-red-400 mt-1">Pick at least one day.</p>}
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-medium text-white/70">Images <span className="ml-1 text-white/40">({group.images.length})</span></p>
                      <SlotImages
                        slotId={group.id}
                        images={group.images}
                        imageFiles={imageFiles}
                        onChange={(images) => update(group.id, { images })}
                        emptyText="Drag images here to show them on these days"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/70">Change images</p>
                      <RotateControl value={group.rotate} onChange={(rotate) => update(group.id, { rotate })} imageCount={group.images.length} spanLabel="day" />
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
