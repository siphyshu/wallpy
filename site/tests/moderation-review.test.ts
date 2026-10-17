import { describe, expect, it } from 'vitest';
import { diffVersions, isEmptyDiff, scheduleSummary, type VersionSnapshot } from '@/lib/moderation/review';

const live: VersionSnapshot = {
  title: 'Dunes',
  description: 'Sand.',
  categories: ['landscape'],
  tags: ['desert'],
  license: 'cc-by-4.0',
  licenseNotes: null,
  aiUse: 'none',
  schedule: { slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
  files: [{ path: 'day.jpg', sha256: 'a' }, { path: 'night.jpg', sha256: 'b' }],
};

describe('scheduleSummary', () => {
  it('describes each slot', () => {
    expect(scheduleSummary({ slot: [{ label: 'Work', at: '09:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'], images: ['a.jpg', 'b.jpg'], rotate: 'every 1h' }] }))
      .toEqual(['Work · at 09:00 · Mon–Fri · 2 images (a.jpg, b.jpg) · 1h']);
    expect(scheduleSummary(null)).toEqual([]);
  });
});

describe('diffVersions', () => {
  it('finds nothing when the versions match', () => {
    expect(isEmptyDiff(diffVersions(live, { ...live, tags: ['desert'] }))).toBe(true);
  });

  it('lists changed fields, images and schedule', () => {
    const next: VersionSnapshot = {
      ...live,
      title: 'Dunes at night',
      tags: ['desert', 'stars'],
      aiUse: 'assisted',
      schedule: { slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['stars.jpg'] }] },
      files: [{ path: 'day.jpg', sha256: 'a2' }, { path: 'stars.jpg', sha256: 'c' }],
    };
    const d = diffVersions(live, next);
    expect(d.fields.map((f) => f.field)).toEqual(['Title', 'Tags', 'AI use']);
    expect(d.fields[1]).toEqual({ field: 'Tags', before: 'desert', after: 'desert, stars' });
    // A replaced image counts as removed and added.
    expect(d.added).toEqual(['day.jpg', 'stars.jpg']);
    expect(d.removed).toEqual(['day.jpg', 'night.jpg']);
    expect(d.schedule?.after[1]).toContain('stars.jpg');
  });
});
