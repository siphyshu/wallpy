import { describe, expect, it } from 'vitest';
import { normalizeTag, normalizeTags, parseTagList } from '@/lib/packs/limits';
import { Submission, toRpcPayload } from '@/lib/packs/submission';
import { CATEGORY_IDS, isCategory } from '@/lib/packs/categories';

describe('tags', () => {
  it('normalises to lowercase kebab-case', () => {
    expect(normalizeTag('  Golden Hour ')).toBe('golden-hour');
    expect(normalizeTag('Café/Night!!')).toBe('cafe-night');
    expect(normalizeTag('---')).toBe('');
    expect(normalizeTag('a'.repeat(40))).toHaveLength(30);
  });
  it('dedupes, drops empties, caps at 10', () => {
    expect(normalizeTags(['Sea', 'sea', ' ', 'SEA side'])).toEqual(['sea', 'sea-side']);
    expect(normalizeTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(parseTagList('sunset, Golden hour,,sunset')).toEqual(['sunset', 'golden-hour']);
  });
});

describe('categories', () => {
  const base = {
    title: 'T', ai_use: 'none', uploader_is_artist: true, schedule: {},
    files: [{ path: 'a.jpg', sha256: 'a'.repeat(64) }],
  };
  it('matches the database list', () => {
    expect(CATEGORY_IDS).toEqual(['nature', 'landscapes', 'cities', 'space', 'anime', 'games', 'art', 'minimal', 'abstract', 'seasons']);
    expect(isCategory('games')).toBe(true);
    expect(isCategory('gaming')).toBe(false);
  });
  it('requires one or two known categories', () => {
    expect(Submission.safeParse({ ...base, categories: [] }).success).toBe(false);
    expect(Submission.safeParse({ ...base }).success).toBe(false);
    expect(Submission.safeParse({ ...base, categories: ['memes'] }).success).toBe(false);
    expect(Submission.safeParse({ ...base, categories: ['art', 'space', 'anime'] }).success).toBe(false);
    expect(Submission.safeParse({ ...base, categories: ['art', 'art'] }).success).toBe(false);
    const ok = Submission.safeParse({ ...base, categories: ['art', 'space'], tags: ['Big Sea', 'big sea'] });
    expect(ok.success).toBe(true);
    if (ok.success) {
      const p = toRpcPayload(ok.data);
      expect(p.categories).toEqual(['art', 'space']);
      expect(p.tags).toEqual(['big-sea']);
    }
  });
});
