import { describe, expect, it } from 'vitest';
import { categoryFromPath, galleryApiParams, galleryPath, parseGalleryQuery } from '@/lib/gallery';

const from = (qs: string) => {
  const p = new URLSearchParams(qs);
  return (k: string) => p.get(k);
};

describe('gallery query', () => {
  it('defaults', () => {
    expect(parseGalleryQuery(undefined, from(''))).toEqual({ search: '', category: null, tag: '', sort: 'newest', hideAi: false, page: 1 });
  });

  it('reads the category from the path and the rest from the query string', () => {
    expect(parseGalleryQuery('games', from('q=+zelda+&tag=Pixel Art&sort=popular&ai=hide&page=3'))).toEqual({
      search: 'zelda', category: 'games', tag: 'pixel-art', sort: 'popular', hideAi: true, page: 3,
    });
  });

  it('ignores unknown categories, sorts and bad pages', () => {
    expect(parseGalleryQuery('nope', from('sort=worst&page=-2'))).toMatchObject({ category: null, sort: 'newest', page: 1 });
  });

  it('paths', () => {
    expect(galleryPath(null)).toBe('/gallery');
    expect(galleryPath('pixel-art')).toBe('/gallery/pixel-art');
    expect(categoryFromPath('/gallery/pixel-art')).toBe('pixel-art');
    expect(categoryFromPath('/gallery')).toBeNull();
    expect(categoryFromPath('/gallery/nope')).toBeNull();
  });

  it('builds the same API query the server keys its first page by', () => {
    const q = parseGalleryQuery('space', from('page=2&tag=stars'));
    expect(galleryApiParams(q).toString()).toBe('limit=9&offset=9&sort=newest&category=space&tag=stars');
  });
});
