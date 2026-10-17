// The site's port of the pack spec must agree with spec/ (the reference).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import toml from '@iarna/toml';
import { describe, expect, it } from 'vitest';
import { active, daySegments, slotTimes } from '@/lib/spec/scheduler';
import { fromWall } from '@/lib/spec/time';
import { validateSchedule } from '@/lib/spec/validate';
import type { Schedule } from '@/lib/types';

const SPEC = join(__dirname, '..', '..', 'spec');
const vectors: {
  name: string;
  schedule: Schedule;
  location: { latitude: number; longitude: number; timezone: string } | null;
  timezone: string;
  at: string;
  expect: { image: string; slot: number };
}[] = JSON.parse(readFileSync(join(SPEC, 'vectors', 'vectors.json'), 'utf8')).vectors;

describe('schema copy', () => {
  it('lib/spec/schedule.schema.json is identical to spec/schedule.schema.json', () => {
    expect(readFileSync(join(__dirname, '..', 'lib', 'spec', 'schedule.schema.json'), 'utf8'))
      .toBe(readFileSync(join(SPEC, 'schedule.schema.json'), 'utf8'));
  });
});

describe('scheduler passes spec/vectors', () => {
  it.each(vectors.map((v) => [v.name, v] as const))('%s', async (_name, v) => {
    const [date, time] = v.at.split('T');
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const now = fromWall(Date.UTC(y, mo - 1, d, h, mi), v.timezone);
    const got = await active(v.schedule, now, v.timezone, v.location);
    expect({ image: got.image, slot: got.slot }).toEqual({ image: v.expect.image, slot: v.expect.slot });
  });
});

describe('validator', () => {
  const examples = readdirSync(join(SPEC, 'examples')).filter((f) => f.endsWith('.toml'));
  it.each(examples)('accepts gallery example %s', (f) => {
    expect(validateSchedule(toml.parse(readFileSync(join(SPEC, 'examples', f), 'utf8')))).toEqual([]);
  });

  const album: Schedule = { spec: 2, name: 'A', slot: [{ images: ['a.jpg', 'b.jpg'], rotate: 'every 1d' }] };
  const day: Schedule = {
    spec: 2, name: 'D', slot: [
      { at: 'dawn', images: ['dawn.jpg'] },
      { at: 'sunrise+1h30m', images: ['day.jpg'] },
      { at: 'dusk+1h', images: ['night.jpg'] },
    ],
  };
  const edit = (s: Schedule, fn: (s: Schedule) => void) => { const c = structuredClone(s); fn(c); return c; };

  it.each([
    ['spec 1 shape', { meta: { type: 'album', name: 'x' }, album: { images: ['a.jpg'], interval: '30m' } }],
    ['path traversal', edit(album, (s) => { s.slot[0].images = ['../x.jpg']; })],
    ['non-image file', edit(album, (s) => { s.slot[0].images = ['evil.html']; })],
    ['interval under 5m', edit(album, (s) => { s.slot[0].rotate = 'every 4m'; })],
    ['interval over 7d', edit(album, (s) => { s.slot[0].rotate = 'every 8d'; })],
    ['offset over 12h', edit(day, (s) => { s.slot[2].at = 'dusk+13h'; })],
    ['out of time order', edit(day, (s) => { s.slot.reverse(); })],
    ['duplicate start', edit(day, (s) => { s.slot[2].at = 'dawn'; })],
    ['weekday without a slot', edit(album, (s) => { s.slot[0].days = ['mon']; })],
  ])('rejects %s', (_label, schedule) => {
    expect(validateSchedule(schedule)).not.toEqual([]);
  });

  it('checks pack files against the schedule', () => {
    expect(validateSchedule(album, ['a.jpg', 'b.jpg'])).toEqual([]);
    expect(validateSchedule(album, ['a.jpg'])).toContain('image "b.jpg" is not in the pack');
    expect(validateSchedule(album, ['a.jpg', 'b.jpg', 'c.jpg'])).toContain('image "c.jpg" is in the pack but not used');
  });
});

describe('day timelines (pack page) agree with the scheduler', () => {
  const schedules = [
    ...readdirSync(join(SPEC, 'examples')).filter((f) => f.endsWith('.toml'))
      .map((f) => [f, toml.parse(readFileSync(join(SPEC, 'examples', f), 'utf8')) as unknown as Schedule] as const),
    ...vectors.map((v) => [v.name, v.schedule] as const),
  ];
  // A Monday and a Sunday (wall days), every 20 minutes, at the fallback times.
  const days = [Date.UTC(2026, 9, 12), Date.UTC(2026, 9, 18)];
  it.each(schedules)('%s', async (_name, schedule) => {
    for (const day of days) {
      const runs = daySegments(schedule, day);
      expect(runs[0].from).toBe(day);
      expect(runs.at(-1)!.to).toBe(day + 86_400_000);
      runs.slice(1).forEach((r, i) => expect(r.from).toBe(runs[i].to));
      for (let t = day; t < day + 86_400_000; t += 20 * 60_000) {
        const a = await active(schedule, t, 'UTC', null);
        expect(runs.find((r) => r.from <= t && t < r.to)!.slot).toBe(a.slot);
        const listed = slotTimes(schedule, day).find((s) => s.slot === a.slot && s.from === a.slotStart);
        if (listed) expect(listed.to).toBe(a.slotEnd);
      }
    }
  });
});
