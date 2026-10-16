// The upload builders' model (lib/spec/builder.ts): what they produce must be
// valid spec 2, and real schedules must round-trip through them unchanged.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import toml from '@iarna/toml';
import { describe, expect, it } from 'vitest';
import {
  configToSchedule, defaultConfig, describeDays, describeInterval, fitsBuilder, intervalInRange,
  kindOfSchedule, parseInterval, scheduleToConfig, uncoveredDays, weekSlots, type BuilderConfig,
} from '@/lib/spec/builder';
import { validateSchedule } from '@/lib/spec/validate';
import type { Schedule } from '@/lib/types';

const EXAMPLES = join(__dirname, '..', '..', 'spec', 'examples');
const examples = readdirSync(EXAMPLES).filter((f) => f.endsWith('.toml'))
  .map((f) => [f, toml.parse(readFileSync(join(EXAMPLES, f), 'utf8')) as unknown as Schedule] as const);
const images = (s: Schedule) => [...new Set(s.slot.flatMap((x) => x.images))];
const meta = { name: 'Test' };

function slotsOf(config: BuilderConfig) {
  if (config.mode !== 'builder') throw new Error('expected builder mode');
  return config.slots;
}

describe('real schedules round-trip through the builder', () => {
  it.each(examples)('%s', (_, schedule) => {
    const kind = kindOfSchedule(schedule);
    expect(fitsBuilder(kind, schedule)).toBe(true);
    const back = configToSchedule(kind, scheduleToConfig(kind, schedule), { name: schedule.name, author: schedule.author });
    expect(back.slot).toEqual(schedule.slot);
    expect(validateSchedule(back, images(schedule))).toEqual([]);
  });
});

describe('templates', () => {
  it('daypack: valid once every block has an image, written in time order', () => {
    const config = defaultConfig('daypack', []);
    const slots = slotsOf(config);
    slots.forEach((s, i) => { s.images = [`${i}.jpg`]; });
    slots.reverse(); // the builder may hold them in any order
    const schedule = configToSchedule('daypack', config, meta);
    expect(schedule.slot.map((s) => s.at)).toEqual(['dawn', 'sunrise+30m', 'sunset-30m', 'dusk+30m']);
    expect(validateSchedule(schedule, ['0.jpg', '1.jpg', '2.jpg', '3.jpg'])).toEqual([]);
    expect(kindOfSchedule(schedule)).toBe('daypack');
  });

  it.each(['each-day', 'weekdays-weekend', 'every-day'] as const)('weekpack preset %s covers the week', (preset) => {
    const slots = weekSlots(preset);
    slots.forEach((s, i) => { s.images = [`${i}.jpg`]; });
    expect(uncoveredDays(slots)).toEqual([]);
    const schedule = configToSchedule('weekpack', { mode: 'builder', slots }, meta);
    expect(validateSchedule(schedule, slots.map((_, i) => `${i}.jpg`))).toEqual([]);
    expect(kindOfSchedule(schedule)).toBe('weekpack');
    expect(fitsBuilder('weekpack', schedule)).toBe(true);
  });

  it('album: one slot rotating every hour', () => {
    const schedule = configToSchedule('album', defaultConfig('album', ['a.jpg', 'b.jpg']), meta);
    expect(schedule.slot).toEqual([{ label: 'Album', images: ['a.jpg', 'b.jpg'], rotate: 'every 1h' }]);
    expect(validateSchedule(schedule, ['a.jpg', 'b.jpg'])).toEqual([]);
    expect(kindOfSchedule(schedule)).toBe('album');
  });

  it('weekpack reports uncovered days', () => {
    const slots = weekSlots('weekdays-weekend').slice(0, 1);
    expect(uncoveredDays(slots)).toEqual(['sat', 'sun']);
  });
});

describe('schedules the builders cannot show stay as text', () => {
  const mixed: Schedule = {
    spec: 2, name: 'Mixed',
    slot: [{ at: 'sunrise', images: ['a.jpg'] }, { at: 'sunset', days: ['sat', 'sun'], images: ['b.jpg'] }],
  };
  it('a daypack slot limited to some days', () => {
    const kind = kindOfSchedule(mixed);
    expect(kind).toBe('weekpack');
    expect(fitsBuilder('weekpack', mixed)).toBe(false);
    const config = scheduleToConfig('weekpack', mixed);
    expect(config.mode).toBe('text');
    // and text mode gives back exactly that schedule
    expect(configToSchedule('weekpack', config, { name: 'Mixed' }).slot).toEqual(mixed.slot);
  });
  it('an album that spreads instead of rotating', () => {
    expect(fitsBuilder('album', { slot: [{ images: ['a.jpg', 'b.jpg'] }] })).toBe(false);
  });
  it('a schedule for a different template', () => {
    expect(fitsBuilder('album', mixed)).toBe(false);
  });
});

describe('helpers', () => {
  it.each([
    ['90m', '90m'], ['1h 30m', '90m'], ['2h', '2h'], ['120m', '2h'], ['1d', '1d'], ['2 days', '2d'],
    ['45 min', '45m'], ['', null], ['soon', null], ['0m', null],
  ])('parseInterval(%j) = %j', (input, out) => expect(parseInterval(input)).toBe(out));

  it('interval range is 5 minutes to 7 days', () => {
    expect(intervalInRange('4m')).toBe(false);
    expect(intervalInRange('5m')).toBe(true);
    expect(intervalInRange('7d')).toBe(true);
    expect(intervalInRange('8d')).toBe(false);
  });

  it.each([
    [['mon', 'tue', 'wed', 'thu', 'fri'], 'Mon–Fri'], [['sat', 'sun'], 'Sat, Sun'], [['wed'], 'Wednesday'],
    [undefined, 'Every day'], [['mon', 'wed', 'fri'], 'Mon, Wed, Fri'],
  ] as const)('describeDays(%j) = %s', (days, out) => expect(describeDays(days ? [...days] : undefined)).toBe(out));

  it('describeInterval', () => {
    expect(describeInterval('every 90m')).toBe('1h 30m');
    expect(describeInterval('1d')).toBe('1d');
  });
});
