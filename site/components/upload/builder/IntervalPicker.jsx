import { useState } from 'react';
import { INTERVAL_PRESETS, describeInterval, intervalInRange, parseInterval } from '@/lib/spec/builder';

const LABELS = { '15m': '15 min', '30m': '30 min', '1h': '1 hour', '6h': '6 hours', '1d': '1 day' };

/** "Change image every …": presets, plus a custom interval (5 minutes to 7 days). */
export default function IntervalPicker({ value, onChange, size = 'md' }) {
  const current = value?.replace(/^every /, '') ?? '1h';
  const isPreset = INTERVAL_PRESETS.includes(current);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const commit = () => {
    if (draft === null) return;
    if (!draft.trim()) { setDraft(null); setError(null); return; }
    const parsed = parseInterval(draft);
    if (!parsed) { setError('Try 45m, 2h or 3d'); return; }
    if (!intervalInRange(parsed)) { setError('Between 5 minutes and 7 days'); return; }
    onChange(`every ${parsed}`);
    setDraft(null);
    setError(null);
  };

  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const on = 'bg-white text-black border-white';
  const off = 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {INTERVAL_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setDraft(null); setError(null); onChange(`every ${p}`); }}
            aria-pressed={current === p}
            className={`${pad} rounded-lg border transition-colors font-medium ${current === p ? on : off}`}
          >
            {LABELS[p]}
          </button>
        ))}
        <input
          type="text"
          aria-label="Custom interval"
          placeholder="Custom"
          value={draft ?? (isPreset ? '' : describeInterval(current))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={`${pad} w-24 rounded-lg border font-medium focus:outline-none focus:ring-1 focus:ring-white/30 placeholder-white/40 ${
            !isPreset && draft === null ? on : `bg-white/10 text-white border-white/20 ${error ? 'border-red-400' : ''}`
          }`}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
