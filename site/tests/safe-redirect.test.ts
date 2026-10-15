import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/safe-redirect';

describe('safeRedirectPath', () => {
  it.each(['/', '/gallery', '/packs/zelda-wind-waker?x=1', '/auth/update-password'])('keeps same-site path %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    ['absolute URL', 'https://evil.com'],
    ['protocol-relative URL', '//evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['relative path', 'gallery'],
    ['empty', ''],
    ['null', null],
  ])('rejects %s', (_label, path) => {
    expect(safeRedirectPath(path, '/fallback')).toBe('/fallback');
  });
});
