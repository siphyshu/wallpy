// "Which image is shown" (spec/README.md), ported from spec/reference/wallpy_ref.py
// and checked against spec/vectors/vectors.json (tests/spec.test.ts).
import { DAY, everyMs, resolveAt, toWall, wallDay, weekdayOf, WEEKDAYS, type Location } from '@/lib/spec/time';
import type { Schedule } from '@/lib/types';

const ANCHOR = Date.UTC(2000, 0, 1); // wall time; "every X" counts from here

export type Active = {
  slot: number;
  image: string;
  imageIndex: number;
  /** wall timestamps (see lib/spec/time.ts) */
  slotStart: number;
  slotEnd: number;
};

/** Rules 1 and 2: slots that apply on a wall day, with clamped starts. */
function starts(schedule: Schedule, day: number, location: Location | null): [number, number][] {
  const weekday = weekdayOf(day);
  const out: [number, number][] = [];
  schedule.slot.forEach((s, i) => {
    if (!(s.days ?? WEEKDAYS).includes(weekday)) return;
    let start = resolveAt(s.at ?? '00:00', day, location);
    if (out.length && start < out[out.length - 1][1]) start = out[out.length - 1][1];
    out.push([i, start]);
  });
  return out;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** README "Shuffle order": indices sorted by sha256("<seed>/<index>"). */
async function shuffled(n: number, seed: string): Promise<number[]> {
  const keys = await Promise.all(Array.from({ length: n }, (_, i) => sha256Hex(`${seed}/${i}`)));
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => (keys[a] < keys[b] ? -1 : keys[a] > keys[b] ? 1 : 0));
}

const isoDay = (wall: number) => new Date(wall).toISOString().slice(0, 10);

/**
 * Which image shows at `nowMs` (a real instant) for a user in `timezone`.
 * Async only because Web Crypto's SHA-256 is.
 */
export async function active(schedule: Schedule, nowMs: number, timezone: string, location: Location | null = null): Promise<Active> {
  const now = toWall(nowMs, timezone);
  const today = wallDay(now);

  // Rule 3: last started slot today, else the previous day's last slot.
  let current: [number, number] | undefined = starts(schedule, today, location).filter(([, t]) => t <= now).at(-1);
  for (let back = 1; !current && back < 8; back++) current = starts(schedule, today - back * DAY, location).at(-1);
  if (!current) throw new Error('no slot applies on any day');
  const [slot, start] = current;

  // Rule 4: the next applicable start after this one.
  let end: number | undefined;
  for (let ahead = 0; end === undefined && ahead < 8; ahead++) {
    end = starts(schedule, wallDay(start) + ahead * DAY, location).find(([, t]) => t > start)?.[1];
  }
  if (end === undefined) throw new Error('slot never ends');

  // Rule 5: the image within the slot.
  const s = schedule.slot[slot];
  const n = s.images.length;
  const every = everyMs(s.rotate ?? 'spread');
  let k: number;
  let order: number[];
  if (every === null) {
    k = Math.min(Math.floor((now - start) / ((end - start) / n)), n - 1);
    order = s.shuffle ? await shuffled(n, `${slot}/${isoDay(start)}`) : [...Array(n).keys()];
  } else {
    const cycle = Math.floor((now - ANCHOR) / every);
    k = ((cycle % n) + n) % n;
    order = s.shuffle ? await shuffled(n, `${slot}/${Math.floor(cycle / n)}`) : [...Array(n).keys()];
  }
  const imageIndex = order[k];
  return { slot, image: s.images[imageIndex], imageIndex, slotStart: start, slotEnd: end };
}
