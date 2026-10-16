import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POOL_TYPE } from './dnd';

/**
 * The "Available Images" panel: pick images (checkboxes), drag them onto a
 * block or day group, or add the selection to one. Shows which images aren't
 * used yet (the spec needs every image in the pack to be used).
 */
export default function ImagePool({ imageFiles, usage, targets, onAdd, targetNoun = 'block' }) {
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const chosenTarget = targets.some((t) => t.id === target) ? target : '';

  const toggle = (name) => setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  const startDrag = (e, name) => {
    // Dragging a selected image drags the whole selection.
    const names = selected.includes(name) ? selected : [name];
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(POOL_TYPE, JSON.stringify(names));
    e.dataTransfer.setData('text/plain', names.join(', '));
  };
  const add = () => {
    if (!chosenTarget || selected.length === 0) return;
    onAdd(chosenTarget, selected);
    setSelected([]);
  };
  const unused = imageFiles.filter((f) => !usage.get(f.name)).length;

  return (
    <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-bold text-xl flex items-center gap-2">
          Available Images
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{imageFiles.length}</span>
        </h4>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setSelected(imageFiles.map((f) => f.name))} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors">Select All</button>
        <button onClick={() => setSelected([])} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors">Clear</button>
      </div>
      {unused > 0 && (
        <p className="text-xs text-amber-200/80 mt-1">
          {unused === 1 ? '1 image isn’t' : `${unused} images aren’t`} used yet. Every image needs a {targetNoun}.
        </p>
      )}
      <hr className="my-4 border-white/10" />
      <div className="space-y-2 flex-1 overflow-y-auto scrollbar pr-2">
        {imageFiles.map((file) => {
          const uses = usage.get(file.name) ?? 0;
          return (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => startDrag(e, file.name)}
              className={`flex items-center space-x-3 p-2 bg-white/10 rounded-lg cursor-move transition-all duration-200 ease-out hover:bg-white/15 hover:scale-[1.01] ${selected.includes(file.name) ? 'ring-1 ring-white/40 m-2 mr-0 bg-white/15' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(file.name)}
                onChange={() => toggle(file.name)}
                aria-label={`Select ${file.name}`}
                className="accent-white/80 w-4 h-4"
              />
              <div className="w-24 aspect-[16/9] bg-black/10 rounded overflow-hidden flex items-center justify-center">
                <img src={file.preview} alt={file.name} className="w-full h-full object-cover rounded" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-white/90">{file.name}</p>
                <p className={`text-xs ${uses ? 'text-white/40' : 'text-amber-200/80'}`}>
                  {uses ? `Used ${uses === 1 ? 'once' : `${uses}×`}` : 'Not used yet'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <Select value={chosenTarget} onValueChange={setTarget}>
          <SelectTrigger className="flex-1 bg-[#343434] border-white/20 text-white hover:bg-white/20">
            <SelectValue placeholder="Add selected to..." className="text-white" />
          </SelectTrigger>
          <SelectContent className="bg-[#343434] border-white/20">
            {targets.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-white hover:bg-white/20">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={add}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors disabled:opacity-50"
          disabled={!chosenTarget || selected.length === 0}
        >
          Add
        </button>
      </div>
    </div>
  );
}
