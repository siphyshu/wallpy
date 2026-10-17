import { describe, expect, it } from 'vitest';
import { safeRedirectPath, withRedirect } from '@/lib/safe-redirect';

describe('withRedirect', () => {
  it('carries a same-site redirect', () => {
    expect(withRedirect('/auth/sign-up', '/packs/x?y=1')).toBe('/auth/sign-up?redirect=%2Fpacks%2Fx%3Fy%3D1');
  });
  it.each([null, '', 'https://evil.com', '//evil.com'])('drops %s', (r) => {
    expect(withRedirect('/auth/login', r)).toBe('/auth/login');
  });
});

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
