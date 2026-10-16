import { useState } from 'react';
import { POOL_TYPE, REORDER_TYPE, poolImages, reorderSource } from './dnd';

/**
 * A slot's images in order: drop images from the pool here, drag thumbnails
 * to reorder, × to remove. The order matters (it's the rotation order).
 */
export default function SlotImages({ slotId, images, imageFiles, onChange, emptyText = 'Drag images here' }) {
  const [over, setOver] = useState(false);
  const [dropIndex, setDropIndex] = useState(null);

  const accepts = (e) => e.dataTransfer.types.includes(POOL_TYPE) || e.dataTransfer.types.includes(REORDER_TYPE);
  const insertAt = (e, index) => {
    const dragged = poolImages(e);
    if (dragged) {
      const next = [...images];
      next.splice(index, 0, ...dragged);
      onChange(next);
      return;
    }
    const src = reorderSource(e);
    if (src && src.slotId === slotId && src.index !== index) {
      const next = [...images];
      const [moved] = next.splice(src.index, 1);
      next.splice(src.index < index ? index - 1 : index, 0, moved);
      onChange(next);
    }
  };
  const indexFromEvent = (e, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? index : index + 1;
  };
  const reset = () => { setOver(false); setDropIndex(null); };

  return (
    <div
      onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) reset(); }}
      onDrop={(e) => { e.preventDefault(); insertAt(e, dropIndex ?? images.length); reset(); }}
      className={`rounded-lg transition-colors ${over ? 'bg-white/5' : ''}`}
    >
      {images.length === 0 ? (
        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-out ${over ? 'border-white/40 bg-white/5' : 'border-white/20 hover:border-white/30 hover:bg-white/5'}`}>
          <p className="text-white/40 text-xs">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((name, index) => {
            const file = imageFiles.find((f) => f.name === name);
            const marker = dropIndex === index ? 'before:absolute before:-left-1.5 before:top-0 before:bottom-0 before:w-0.5 before:bg-white/70 before:rounded'
              : dropIndex === index + 1 && index === images.length - 1 ? 'after:absolute after:-right-1.5 after:top-0 after:bottom-0 after:w-0.5 after:bg-white/70 after:rounded' : '';
            return (
              <div
                key={`${name}-${index}`}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(REORDER_TYPE, JSON.stringify({ slotId, index }));
                }}
                onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); e.stopPropagation(); setOver(true); setDropIndex(indexFromEvent(e, index)); } }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); insertAt(e, indexFromEvent(e, index)); reset(); }}
                onDragEnd={reset}
                className={`relative group transition-all duration-200 ease-out hover:scale-[1.02] cursor-move ${marker}`}
              >
                <div className="w-full aspect-[16/9] bg-black/10 rounded overflow-hidden flex items-center justify-center">
                  <img src={file?.preview} alt={name} className="w-full h-full object-cover rounded" />
                </div>
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{index + 1}</div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate">{name}</div>
                <button
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full transition-all duration-200 ease-out flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Remove image"
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
