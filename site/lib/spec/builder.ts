// The upload wizard's builders keep their own state (timeblocks / days / album,
// as in spec 1). This turns it into a spec 2 schedule, the same mapping as
// spec/reference/wallpy_ref.py convert_v1, minus end times: a block runs until
// the next one starts.
import { fallbackMinutes } from '@/lib/spec/time';
import type { Schedule, Slot, Weekday } from '@/lib/types';

export type BuilderKind = 'daypack' | 'weekpack' | 'album';

type Block = { start: string; images: string[]; shuffle?: boolean };
export type BuilderConfig = {
  timeblocks?: Record<string, Block>;
  days?: Record<string, { images: string[]; shuffle?: boolean }>;
  album?: { images: string[]; shuffle?: boolean; interval?: string };
};

const DAY_IDS: Record<string, Weekday> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun',
};

function minutes(at: string): number {
  try {
    return fallbackMinutes(at);
  } catch {
    return Number.POSITIVE_INFINITY; // invalid times sort last; the validator reports them
  }
}

/** A block name usable as a slot label (spec: letters, digits, space, _ and -). */
function label(name: string): string | undefined {
  const cleaned = name.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 32);
  return /^[A-Za-z0-9]/.test(cleaned) ? cleaned : undefined;
}

export function builderToSchedule(kind: BuilderKind, config: BuilderConfig, meta: { name: string; author?: string }): Schedule {
  let slot: Slot[];
  if (kind === 'daypack') {
    slot = Object.entries(config.timeblocks ?? {})
      .sort(([, a], [, b]) => minutes(a.start) - minutes(b.start))
      .map(([name, b]) => ({
        ...(label(name) ? { label: label(name) } : {}),
        at: b.start,
        images: [...b.images],
        ...(b.shuffle ? { shuffle: true } : {}),
      }));
  } else if (kind === 'weekpack') {
    slot = Object.entries(config.days ?? {}).map(([day, d]) => ({
      label: day,
      days: [DAY_IDS[day] ?? (day as Weekday)],
      images: [...d.images],
      ...(d.shuffle ? { shuffle: true } : {}),
    }));
  } else {
    const a = config.album ?? { images: [] };
    slot = [{ images: [...a.images], rotate: `every ${a.interval ?? '1h'}`, ...(a.shuffle ? { shuffle: true } : {}) }];
  }
  return {
    spec: 2,
    name: meta.name.trim() || 'Untitled',
    ...(meta.author?.trim() ? { author: meta.author.trim() } : {}),
    slot,
  };
}

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
};

/**
 * Back from a spec 2 schedule (or a spec 1 file, for old packs) to the
 * builders' state: lets people edit the schedule as text or import a file.
 */
export function scheduleToBuilder(kind: BuilderKind, file: unknown): BuilderConfig {
  const f = file as Record<string, unknown>;
  // Spec 1 files already have the builders' shape; spec 2 has no end times.
  if (f && typeof f === 'object' && 'meta' in f) {
    const v1 = f as BuilderConfig;
    if (v1.timeblocks) {
      v1.timeblocks = Object.fromEntries(
        Object.entries(v1.timeblocks).map(([name, b]) => [name, { start: b.start, images: b.images, shuffle: b.shuffle }]),
      );
    }
    return v1;
  }
  const schedule = file as Schedule;
  if (schedule?.spec !== 2 || !Array.isArray(schedule.slot)) throw new Error('Not a Wallpy schedule (expected spec = 2)');
  if (kind === 'daypack') {
    return {
      timeblocks: Object.fromEntries(schedule.slot.map((s, i) => [
        s.label ?? `Block ${i + 1}`,
        { start: s.at ?? '00:00', images: [...s.images], shuffle: Boolean(s.shuffle) },
      ])),
    };
  }
  if (kind === 'weekpack') {
    const days: NonNullable<BuilderConfig['days']> = {};
    for (const s of schedule.slot) {
      for (const d of s.days ?? (Object.keys(DAY_NAMES) as Weekday[])) {
        days[DAY_NAMES[d]] = { images: [...s.images], shuffle: Boolean(s.shuffle) };
      }
    }
    return { days };
  }
  const s = schedule.slot[0];
  return { album: { images: [...s.images], shuffle: Boolean(s.shuffle), interval: s.rotate?.replace(/^every /, '') ?? '1h' } };
}
