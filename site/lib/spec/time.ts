// Times for the pack spec (spec/README.md). All scheduling happens in local
// wall-clock time, represented here as a "wall" timestamp: the milliseconds
// a UTC clock would show at the same wall-clock reading. Arithmetic on walls
// is wall-clock arithmetic, exactly as the spec requires.
import { getTimes } from 'suncalc';
import schema from '@/lib/spec/schedule.schema.json';

export type Location = { latitude: number; longitude: number; timezone: string };
export type SolarEvent = 'midnight' | 'dawn' | 'sunrise' | 'noon' | 'sunset' | 'dusk';
export type ParsedAt =
  | { kind: 'clock'; hour: number; minute: number }
  | { kind: 'solar'; event: SolarEvent; offsetMinutes: number };

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** The spec's own pattern for `at` (spec/schedule.schema.json), for live form validation. */
export const TIME_PATTERN = new RegExp(schema.$defs.time.pattern);

/** Used without a location, or when an event doesn't happen (polar day/night). */
export const FALLBACKS: Record<SolarEvent, [number, number]> = {
  midnight: [0, 0], dawn: [5, 0], sunrise: [6, 30], noon: [12, 0], sunset: [18, 30], dusk: [19, 30],
};

const CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
const SOLAR = /^(midnight|dawn|sunrise|noon|sunset|dusk)(?:([+-])(?:(\d+)h)?(?:(\d+)m)?)?$/;
const EVERY = /^every ([1-9][0-9]{0,4})([mhd])$/;
const MINUTE = 60_000;
export const DAY = 86_400_000;

export function parseAt(at: string): ParsedAt {
  let m = CLOCK.exec(at);
  if (m) return { kind: 'clock', hour: Number(m[1]), minute: Number(m[2]) };
  m = SOLAR.exec(at);
  if (m) {
    const offset = Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
    return { kind: 'solar', event: m[1] as SolarEvent, offsetMinutes: m[2] === '-' ? -offset : offset };
  }
  throw new Error(`invalid time ${JSON.stringify(at)}`);
}

/** Minutes after midnight at the fallback times. */
export function fallbackMinutes(at: string): number {
  const p = parseAt(at);
  const [h, m] = p.kind === 'clock' ? [p.hour, p.minute] : FALLBACKS[p.event];
  return h * 60 + m + (p.kind === 'solar' ? p.offsetMinutes : 0);
}

export function everyMs(rotate: string): number | null {
  const m = EVERY.exec(rotate);
  return m ? Number(m[1]) * { m: 60_000, h: 3_600_000, d: DAY }[m[2] as 'm' | 'h' | 'd'] : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The wall-clock reading of an instant in `timezone`, as a wall timestamp. */
export function toWall(instantMs: number, timezone: string): number {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(timezone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) + (instantMs % 1000);
}

/** Midnight (wall) of the day containing `wall`. */
export function wallDay(wall: number): number {
  return Math.floor(wall / DAY) * DAY;
}

export function weekdayOf(wallDayMs: number): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[(new Date(wallDayMs).getUTCDay() + 6) % 7];
}

function solarWall(event: SolarEvent, day: number, location: Location | null): number {
  const fallback = () => day + (FALLBACKS[event][0] * 60 + FALLBACKS[event][1]) * MINUTE;
  if (event === 'midnight' || !location) return fallback();
  // suncalc picks the day from the instant it's given: ask at local noon.
  const noonInstant = day + 12 * 3_600_000 - (toWall(day + 12 * 3_600_000, location.timezone) - (day + 12 * 3_600_000));
  const times = getTimes(new Date(noonInstant), location.latitude, location.longitude);
  const key = event === 'noon' ? 'solarNoon' : event; // dawn/dusk are civil twilight, as in the spec
  // Events that don't happen that day (polar day/night) come back as null
  // (suncalc 2) or an invalid Date (suncalc 1): use the fallback.
  const t = times[key as keyof typeof times] as Date | null;
  return t && Number.isFinite(t.getTime()) ? toWall(t.getTime(), location.timezone) : fallback();
}

/** Start (wall) of `at` on the wall day `day`. */
export function resolveAt(at: string, day: number, location: Location | null): number {
  const p = parseAt(at);
  if (p.kind === 'clock') return day + (p.hour * 60 + p.minute) * MINUTE;
  return solarWall(p.event, day, location) + p.offsetMinutes * MINUTE;
}

/** The instant at which `timezone` shows the wall time `wall` (inverse of toWall). */
export function fromWall(wall: number, timezone: string): number {
  // Two passes settle the UTC offset, including around DST changes.
  let instant = wall - (toWall(wall, timezone) - wall);
  instant = wall - (toWall(instant, timezone) - instant);
  return instant;
}
