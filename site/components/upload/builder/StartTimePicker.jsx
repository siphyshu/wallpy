import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIME_PATTERN, fallbackMinutes } from '@/lib/spec/time';

const EVENTS = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'noon', label: 'Noon' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'midnight', label: 'Midnight' },
];
const SOLAR = /^(midnight|dawn|sunrise|noon|sunset|dusk)(?:([+-])(.+))?$/;

const pad = (n) => String(n).padStart(2, '0');
export const formatMinutes = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

function split(at) {
  const m = SOLAR.exec(at ?? '');
  if (m) return { mode: m[1], offset: m[2] ? `${m[2]}${m[3]}` : '' };
  return { mode: 'clock', offset: '' };
}

/** "+1h 30m", "-45m", "90m" → "+90m" style suffix the spec accepts, or null. */
function normaliseOffset(input) {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return '';
  const m = /^([+-]?)(?:(\d+)h)?(?:(\d+)m)?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const minutes = Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  if (minutes === 0) return '';
  if (minutes > 720) return null;
  const sign = m[1] === '-' ? '-' : '+';
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${sign}${h ? `${h}h` : ''}${rest ? `${rest}m` : ''}`;
}

/**
 * When a block starts: a solar event with an optional offset, or a clock time.
 * Always produces a value the spec accepts; shows the typical clock time.
 */
export default function StartTimePicker({ value, onChange, id }) {
  const { mode, offset } = split(value);
  const [draft, setDraft] = useState(null); // offset being typed
  const [error, setError] = useState(null);

  const commitOffset = () => {
    if (draft === null) return;
    const normal = normaliseOffset(draft);
    if (normal === null) {
      setError('Use something like +30m, -1h or +1h 30m (up to 12 hours)');
      return;
    }
    const next = `${mode}${normal}`;
    if (TIME_PATTERN.test(next)) onChange(next);
    setDraft(null);
    setError(null);
  };
  const setMode = (m) => {
    setDraft(null);
    setError(null);
    if (m === 'clock') onChange(formatMinutes(fallbackMinutes(value || '00:00')));
    else onChange(m); // a new event starts without an offset; add one next to it
  };

  let typical = null;
  try { typical = formatMinutes(fallbackMinutes(value)); } catch {}

  const field = 'w-full px-2 py-1.5 bg-white/10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-white text-xs';
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger id={id} className="h-[30px] text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#343434] border-white/20">
            {EVENTS.map((e) => (
              <SelectItem key={e.value} value={e.value} className="text-white hover:bg-white/20">{e.label}</SelectItem>
            ))}
            <SelectItem value="clock" className="text-white hover:bg-white/20">Clock time</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'clock' ? (
          <input
            type="time"
            aria-label="Start time"
            value={TIME_PATTERN.test(value) && !SOLAR.test(value) ? value : ''}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className={`${field} w-28 border-white/20 [color-scheme:dark]`}
          />
        ) : (
          <input
            type="text"
            aria-label="Offset"
            value={draft ?? offset}
            placeholder="+0m"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitOffset}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={`${field} w-28 ${error ? 'border-red-400' : 'border-white/20'}`}
          />
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      ) : (
        mode !== 'clock' && typical && <p className="text-[11px] text-white/40 mt-1 truncate" title="Solar times follow the real sun where each computer is">Around {typical}, following the sun</p>
      )}
    </div>
  );
}
