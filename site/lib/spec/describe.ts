// Schedules in words: slot names, day groups, intervals. Shared by the upload
// builders (re-exported from lib/spec/builder.ts) and the pack page, which
// shouldn't pull in the builders' TOML parser.
import { WEEKDAYS, everyMs } from '@/lib/spec/time';
import type { Weekday } from '@/lib/types';

export type BuilderKind = 'daypack' | 'weekpack' | 'album';

export const SOLAR_EVENTS = ['dawn', 'sunrise', 'noon', 'sunset', 'dusk', 'midnight'] as const;

export const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/** "Mon–Fri", "Sat, Sun", "Every day": a group of weekdays in words. */
export function describeDays(days: Weekday[] | undefined): string {
  const set = new Set(days ?? WEEKDAYS);
  if (set.size === 7) return 'Every day';
  if (set.size === 0) return 'No days';
  const idx = WEEKDAYS.map((d, i) => (set.has(d) ? i : -1)).filter((i) => i >= 0);
  const runs: number[][] = [];
  for (const i of idx) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === i - 1) run.push(i);
    else runs.push([i]);
  }
  const short = (i: number) => DAY_NAMES[WEEKDAYS[i]].slice(0, 3);
  if (runs.length === 1 && runs[0].length === 1) return DAY_NAMES[WEEKDAYS[runs[0][0]]];
  return runs.map((r) => (r.length >= 3 ? `${short(r[0])}–${short(r[r.length - 1])}` : r.map(short).join(', '))).join(', ');
}

/** "every 90m" → "1h 30m"; for buttons and summaries. */
export function describeInterval(rotate: string): string {
  const ms = everyMs(rotate.startsWith('every ') ? rotate : `every ${rotate}`);
  if (ms === null) return rotate.replace(/^every /, '');
  let minutes = Math.round(ms / 60_000);
  const parts: string[] = [];
  for (const [unit, size] of [['d', 1440], ['h', 60], ['m', 1]] as const) {
    if (minutes >= size) {
      parts.push(`${Math.floor(minutes / size)}${unit}`);
      minutes %= size;
    }
  }
  return parts.join(' ');
}

/** A name for an unnamed slot: its start event ("Sunrise") or its days ("Mon–Fri"). */
export function displayLabel(s: { label: string; at?: string; days?: Weekday[] }, kind: BuilderKind, index: number): string {
  if (s.label.trim()) return s.label;
  if (kind === 'weekpack') return describeDays(s.days);
  const event = s.at?.match(/^[a-z]+/)?.[0];
  if (event && (SOLAR_EVENTS as readonly string[]).includes(event)) return event[0].toUpperCase() + event.slice(1);
  return `Block ${index + 1}`;
}
