import { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Shuffle } from 'lucide-react';
import ImagePool from './builder/ImagePool';
import SlotImages from './builder/SlotImages';
import StartTimePicker, { formatMinutes } from './builder/StartTimePicker';
import RotateControl from './builder/RotateControl';
import { SOLAR_EVENTS, displayLabel, inTimeOrder, newSlotId, startMinutes } from '@/lib/spec/builder';

/**
 * Daypack: blocks through the day. Each block starts at a solar event or a
 * clock time and runs until the next one starts; blocks are always shown in
 * the order they start (that's the order they're written in).
 */
export default function DaypackBuilder({ scheduleConfig, imageFiles, onConfigChange }) {
  const [newBlockName, setNewBlockName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [overId, setOverId] = useState(null);

  const slots = inTimeOrder(scheduleConfig.slots);
  const setSlots = (next) => onConfigChange({ mode: 'builder', slots: next });
  const update = (id, patch) => setSlots(scheduleConfig.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const usage = new Map();
  slots.forEach((s) => s.images.forEach((n) => usage.set(n, (usage.get(n) ?? 0) + 1)));
  const names = slots.map((s, i) => displayLabel(s, 'daypack', i));

  const addBlock = () => {
    // Start at the first solar event no block uses yet, else noon.
    const used = new Set(slots.map((s) => s.at));
    const at = SOLAR_EVENTS.find((e) => !used.has(e)) ?? '12:00';
    setSlots([...scheduleConfig.slots, { id: newSlotId(), label: newBlockName.trim().slice(0, 32), at, images: [], rotate: 'spread', shuffle: false }]);
    setNewBlockName('');
  };

  const autoAssign = () => {
    const per = Math.ceil(imageFiles.length / Math.max(slots.length, 1));
    const byId = new Map(slots.map((s, i) => [s.id, imageFiles.slice(i * per, (i + 1) * per).map((f) => f.name)]));
    setSlots(scheduleConfig.slots.map((s) => ({ ...s, images: byId.get(s.id) ?? [] })));
  };

  const until = (index) => {
    if (slots.length < 2) return { text: 'The same time tomorrow', title: '' };
    const next = slots[(index + 1) % slots.length];
    let time = '';
    try { time = formatMinutes(startMinutes(next.at)); } catch {}
    return { text: `${names[(index + 1) % slots.length]}${time ? ` · ~${time}` : ''}`, title: `${next.at}${index === slots.length - 1 ? ' (next day)' : ''}` };
  };

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="sr-only">Configure Daypack Schedule</h2>
        <p className="text-white/70 max-w-2xl mx-auto mb-4">
          Set up blocks through the day. Each block starts at sunrise, sunset or a set time, and runs until the next one starts.
          <a href="#configuration-guide" className="underline text-white/70 hover:text-white ml-1">See the configuration guide for tips.</a>
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 mb-0">
        <div className="lg:col-span-1 max-h-[800px] overflow-y-auto">
          <ImagePool
            imageFiles={imageFiles}
            usage={usage}
            targets={slots.map((s, i) => ({ id: s.id, label: names[i] }))}
            onAdd={(id, added) => update(id, { images: [...scheduleConfig.slots.find((s) => s.id === id).images, ...added] })}
          />
        </div>

        <div className="lg:col-span-2 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Time Blocks
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{slots.length}</span>
              </h4>
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-2 md:space-y-0 mb-4">
              <input
                type="text"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="New block name (e.g. Morning)"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') addBlock(); }}
              />
              <button onClick={addBlock} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors" title="Add time block">
                <PlusIcon className="w-4 h-4" /> Add Time Block
              </button>
              <button onClick={autoAssign} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors" title="Share the images out across the blocks, in order">
                <ArrowPathIcon className="w-4 h-4" /> Auto-assign Images
              </button>
            </div>
            <hr className="my-4 border-white/10" />
            <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-y-auto scrollbar pr-2">
              {slots.map((block, index) => {
                const u = until(index);
                return (
                  <section
                    key={block.id}
                    aria-label={names[index]}
                    onDragEnter={() => setOverId(block.id)}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); }}
                    onDrop={() => setOverId(null)}
                    className={`bg-white/5 rounded-xl shadow-lg p-5 border-2 transition-all duration-300 ease-out relative group ${overId === block.id ? 'border-white/40 bg-white/10' : 'border-white/10 hover:bg-white/[0.07]'}`}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      {editingId === block.id ? (
                        <input
                          type="text"
                          value={block.label}
                          autoFocus
                          maxLength={32}
                          onChange={(e) => update(block.id, { label: e.target.value.replace(/[^A-Za-z0-9 _-]/g, '') })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEditingId(null); }}
                          placeholder={names[index]}
                          className="text-lg font-bold bg-transparent border-b border-white/20 outline-none text-white px-1 py-0.5 w-40"
                        />
                      ) : (
                        <button className="text-lg font-bold text-white hover:underline truncate" onClick={() => setEditingId(block.id)} title="Rename block">
                          {names[index]}
                        </button>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => update(block.id, { shuffle: !block.shuffle })}
                          aria-pressed={block.shuffle}
                          className={`p-2 rounded-full border border-white/20 transition-colors ${block.shuffle ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          title={block.shuffle ? 'Shuffle on: images in a random order' : 'Shuffle off: images in this order'}
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                        {slots.length > 1 && (
                          <button
                            onClick={() => setSlots(scheduleConfig.slots.filter((s) => s.id !== block.id))}
                            className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors border border-white/20"
                            title="Remove block"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-[3fr_2fr] gap-3 mb-4">
                      <div>
                        <label htmlFor={`${block.id}-at`} className="block text-xs font-medium mb-1 text-white/60">Starts</label>
                        <StartTimePicker id={`${block.id}-at`} value={block.at} onChange={(at) => update(block.id, { at })} />
                      </div>
                      <div>
                        <span className="block text-xs font-medium mb-1 text-white/60">Until</span>
                        <div className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs truncate" title={u.title}>
                          {u.text}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-medium text-white/70">Images <span className="ml-1 text-white/40">({block.images.length})</span></p>
                      <SlotImages
                        slotId={block.id}
                        images={block.images}
                        imageFiles={imageFiles}
                        onChange={(images) => update(block.id, { images })}
                        emptyText="Drag images here to show them in this block"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/70">Change images</p>
                      <RotateControl value={block.rotate} onChange={(rotate) => update(block.id, { rotate })} imageCount={block.images.length} />
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
