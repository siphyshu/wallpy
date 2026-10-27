import { describe, expect, it } from 'vitest';
import { rotateCaption, shareStrip, spread } from '@/lib/share';
import type { Schedule } from '@/lib/types';

const sched = (slot: Schedule['slot']): Schedule => ({ spec: 2, name: 'x', slot });

describe('share strip', () => {
  it('spreads picks evenly and keeps both ends', () => {
    expect(spread([1, 2, 3], 6)).toEqual([1, 2, 3]);
    expect(spread(Array.from({ length: 16 }, (_, i) => i), 6)).toEqual([0, 3, 6, 9, 12, 15]);
  });

  it('labels Daypack slots, falling back to the time', () => {
    const s = sched([{ at: 'dawn', label: 'dawn', images: ['a.jpg', 'b.jpg'] }, { at: 'sunset', images: ['c.jpg'] }]);
    expect(shareStrip(s, 'timeblocks')).toEqual({ stops: [{ label: 'Dawn', image: 'a.jpg' }, { label: 'sunset', image: 'c.jpg' }], caption: null });
  });

  it('labels Weekpack slots by their days', () => {
    const s = sched([{ days: ['mon'], images: ['m.jpg'] }, { days: ['sat', 'sun'], images: ['w.jpg'] }]);
    expect(shareStrip(s, 'days').stops.map((x) => x.label)).toEqual(['Mon', 'Sat, Sun']);
  });

  it('gives Albums a caption instead of labels', () => {
    const s = sched([{ images: ['1.jpg', '2.jpg', '3.jpg'], rotate: 'every 20m' }]);
    expect(shareStrip(s, 'album')).toEqual({
      stops: [{ label: '', image: '1.jpg' }, { label: '', image: '2.jpg' }, { label: '', image: '3.jpg' }],
      caption: 'A new image every 20 minutes',
    });
    expect(rotateCaption('every 1h')).toBe('A new image every hour');
    expect(rotateCaption('spread')).toBeNull();
  });
});
