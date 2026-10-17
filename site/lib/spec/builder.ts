// The upload wizard's schedule builders work directly on spec 2 slots. Each
// template (Daypack, Weekpack, Album) is a preset of the one slot shape
// (spec/README.md):
//
//   daypack   slots with `at`, every day          (kind "timeblocks")
//   weekpack  slots with `days`, from midnight    (kind "days")
//   album     one slot, no `at`, rotate "every …" (kind "album")
//
// A schedule that doesn't fit its template's builder (a hand-written file, say)
// is kept as text instead, so it's never reshaped without the uploader seeing.
import toml from '@iarna/toml';
import { WEEKDAYS, fallbackMinutes, everyMs } from '@/lib/spec/time';
import { DAY_NAMES, describeDays, describeInterval, displayLabel, SOLAR_EVENTS, type BuilderKind } from '@/lib/spec/describe';
import type { PackKind, Schedule, Slot, Weekday } from '@/lib/types';

export { DAY_NAMES, describeDays, describeInterval, displayLabel, SOLAR_EVENTS, type BuilderKind };

/** A slot being edited: always has an id (for React) and a label (for people). */
export type BuilderSlot = {
  id: string;
  label: string;
  at?: string;
  days?: Weekday[];
  images: string[];
  rotate: string;
  shuffle: boolean;
};

export type BuilderConfig =
  | { mode: 'builder'; slots: BuilderSlot[] }
  | { mode: 'text'; text: string };

export const BUILDER_KINDS: Record<PackKind, BuilderKind> = { timeblocks: 'daypack', days: 'weekpack', album: 'album' };

/** Interval presets offered by the builders ("every …"). */
export const INTERVAL_PRESETS = ['15m', '30m', '1h', '6h', '1d'] as const;

const ALL_DAYS: Weekday[] = [...WEEKDAYS];

let counter = 0;
export function newSlotId(): string {
  counter += 1;
  return `slot-${Date.now().toString(36)}-${counter}`;
}

function slot(fields: Partial<BuilderSlot>): BuilderSlot {
  return { id: newSlotId(), label: '', images: [], rotate: 'spread', shuffle: false, ...fields };
}

/** Minutes after midnight at the fallback solar times; invalid times sort last. */
export function startMinutes(at: string | undefined): number {
  try {
    return fallbackMinutes(at ?? '00:00');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Daypack blocks always show (and are written) in the order they start. */
export function inTimeOrder(slots: BuilderSlot[]): BuilderSlot[] {
  return [...slots].sort((a, b) => startMinutes(a.at) - startMinutes(b.at));
}

/**
 * A typed interval ("90m", "1h 30m", "2 days") in the spec's one-unit form
 * ("90m", "2d"), using the largest unit that divides it; null if unreadable.
 */
export function parseInterval(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/days?/g, 'd').replace(/hours?|hrs?/g, 'h').replace(/minutes?|mins?/g, 'm');
  const m = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/.exec(s);
  if (!s || !m) return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  if (minutes <= 0) return null;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

/** The interval range the spec allows (5 minutes to 7 days). */
export function intervalInRange(interval: string): boolean {
  const ms = everyMs(`every ${interval}`);
  return ms !== null && ms >= 5 * 60_000 && ms <= 7 * 86_400_000;
}

/** A label the spec accepts, or undefined. */
function cleanLabel(name: string): string | undefined {
  const cleaned = name.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 32);
  return /^[A-Za-z0-9]/.test(cleaned) ? cleaned : undefined;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type WeekPreset = 'each-day' | 'weekdays-weekend' | 'every-day';

export function weekSlots(preset: WeekPreset): BuilderSlot[] {
  if (preset === 'every-day') return [slot({ days: [...ALL_DAYS] })];
  if (preset === 'weekdays-weekend') {
    return [slot({ label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }), slot({ label: 'Weekend', days: ['sat', 'sun'] })];
  }
  return ALL_DAYS.map((d) => slot({ label: DAY_NAMES[d], days: [d] }));
}

/** Where each builder starts. */
export function defaultConfig(kind: BuilderKind, imageNames: string[]): BuilderConfig {
  if (kind === 'weekpack') return { mode: 'builder', slots: weekSlots('each-day') };
  if (kind === 'album') return { mode: 'builder', slots: [slot({ label: 'Album', images: [...imageNames], rotate: 'every 1h' })] };
  return {
    mode: 'builder',
    slots: [
      slot({ label: 'Dawn', at: 'dawn' }),
      slot({ label: 'Day', at: 'sunrise+30m' }),
      slot({ label: 'Sunset', at: 'sunset-30m' }),
      slot({ label: 'Night', at: 'dusk+30m' }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Builder state <-> spec 2
// ---------------------------------------------------------------------------

function toSlot(s: BuilderSlot, kind: BuilderKind, index: number): Slot {
  const label = cleanLabel(s.label) ?? cleanLabel(displayLabel(s, kind, index));
  const days = s.days && s.days.length < 7 ? WEEKDAYS.filter((d) => s.days!.includes(d)) : s.days;
  return {
    ...(label ? { label } : {}),
    ...(kind === 'daypack' ? { at: s.at ?? '00:00' } : {}),
    // A Weekpack's slots always say their days, even "every day": that's what makes it a Weekpack.
    ...(kind === 'weekpack' ? { days: days ?? [...ALL_DAYS] } : {}),
    images: [...s.images],
    ...(s.rotate !== 'spread' ? { rotate: s.rotate } : {}),
    ...(s.shuffle ? { shuffle: true } : {}),
  };
}

/**
 * The spec 2 schedule a config describes. Text mode is parsed as TOML (it
 * throws on a syntax error); name and author always come from the pack's details.
 */
export function configToSchedule(kind: BuilderKind, config: BuilderConfig, meta: { name: string; author?: string; description?: string }): Schedule {
  const head = {
    spec: 2 as const,
    name: meta.name.trim() || 'Untitled',
    ...(meta.author?.trim() ? { author: meta.author.trim() } : {}),
  };
  if (config.mode === 'text') {
    const parsed = toml.parse(config.text) as unknown as Partial<Schedule>;
    return { ...parsed, ...head, slot: (parsed.slot ?? []) as Slot[] } as Schedule;
  }
  const ordered = kind === 'daypack' ? inTimeOrder(config.slots) : config.slots;
  return { ...head, slot: ordered.map((s, i) => toSlot(s, kind, i)) };
}

/** schedule_kind() in the database: which template a schedule belongs to. */
export function kindOfSchedule(schedule: Pick<Schedule, 'slot'>): BuilderKind {
  if (schedule.slot.some((s) => s.days)) return 'weekpack';
  if (!schedule.slot.some((s) => s.at !== undefined)) return 'album';
  return 'daypack';
}

/** Can this template's builder show the schedule exactly? */
export function fitsBuilder(kind: BuilderKind, schedule: Pick<Schedule, 'slot'>): boolean {
  const slots = schedule.slot ?? [];
  if (kindOfSchedule(schedule) !== kind || slots.length === 0) return false;
  if (kind === 'album') return slots.length === 1 && Boolean(slots[0].rotate?.startsWith('every '));
  if (kind === 'weekpack') return slots.every((s) => s.at === undefined || s.at === '00:00' || s.at === 'midnight');
  // Daypack: every day, written in time order (the builder always shows time order).
  if (slots.some((s) => s.days && s.days.length < 7)) return false;
  return slots.every((s, i) => i === 0 || startMinutes(slots[i - 1].at) <= startMinutes(s.at));
}

/** Builder state for a schedule: the builder if it fits, else text. */
export function scheduleToConfig(kind: BuilderKind, schedule: Schedule): BuilderConfig {
  if (!fitsBuilder(kind, schedule)) return { mode: 'text', text: scheduleToToml(schedule) };
  return {
    mode: 'builder',
    slots: schedule.slot.map((s) => slot({
      label: s.label ?? '',
      ...(kind === 'daypack' ? { at: s.at ?? '00:00' } : {}),
      ...(kind === 'weekpack' ? { days: s.days ? [...s.days] : [...ALL_DAYS] } : {}),
      images: [...s.images],
      rotate: s.rotate ?? 'spread',
      shuffle: Boolean(s.shuffle),
    })),
  };
}

export function scheduleToToml(schedule: Schedule): string {
  return toml.stringify(schedule as unknown as toml.JsonMap);
}

/** Weekdays no slot covers (the spec requires every day to be covered). */
export function uncoveredDays(slots: BuilderSlot[]): Weekday[] {
  const covered = new Set(slots.flatMap((s) => s.days ?? ALL_DAYS));
  return ALL_DAYS.filter((d) => !covered.has(d));
}
