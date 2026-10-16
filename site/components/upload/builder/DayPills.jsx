import { WEEKDAYS } from '@/lib/spec/time';
import { DAY_NAMES } from '@/lib/spec/builder';

/** Weekday toggles for a day group. Days another group has are shown but can't be picked. */
export default function DayPills({ value, takenBy, onChange }) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((d) => {
        const on = set.has(d);
        const owner = takenBy.get(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={DAY_NAMES[d]}
            disabled={!on && Boolean(owner)}
            title={!on && owner ? `${DAY_NAMES[d]} is in ${owner}` : DAY_NAMES[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : WEEKDAYS.filter((x) => set.has(x) || x === d))}
            className={`w-9 h-8 rounded-lg border text-xs font-medium transition-colors ${
              on ? 'bg-white text-black border-white'
                : owner ? 'bg-white/5 text-white/25 border-white/10 cursor-not-allowed'
                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
            }`}
          >
            {DAY_NAMES[d].slice(0, 2)}
          </button>
        );
      })}
    </div>
  );
}
