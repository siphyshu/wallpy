import IntervalPicker from './IntervalPicker';

/**
 * How a block's (or day group's) images take turns: split its time evenly
 * ("spread"), or change on a fixed interval. With one image there's nothing to choose.
 */
export default function RotateControl({ value, onChange, imageCount, spanLabel = 'block' }) {
  if (imageCount < 2) {
    return <p className="text-xs text-white/40">{imageCount === 1 ? `One image: shown for the whole ${spanLabel}.` : 'Add images to choose how they change.'}</p>;
  }
  const every = value.startsWith('every ');
  const option = (active) => `px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
    active ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10'
  }`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={!every} onClick={() => onChange('spread')} className={option(!every)}>
          Across the {spanLabel}
        </button>
        <button type="button" aria-pressed={every} onClick={() => !every && onChange('every 1h')} className={option(every)}>
          Every…
        </button>
      </div>
      {every ? (
        <IntervalPicker value={value} onChange={onChange} size="sm" />
      ) : (
        <p className="text-[11px] text-white/40">The {spanLabel}&apos;s time is split evenly, one image after another.</p>
      )}
    </div>
  );
}
