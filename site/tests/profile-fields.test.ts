import { describe, expect, it } from 'vitest';
import { checkProfileFields, normalizeUrl, profileSaveError } from '@/lib/profile-fields';

describe('normalizeUrl', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['  example.com/me ', 'https://example.com/me'],
    ['http://example.com', 'http://example.com'],
    ['HTTPS://example.com', 'HTTPS://example.com'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['', ''],
  ])('%s -> %s', (input, out) => expect(normalizeUrl(input)).toBe(out));
});

describe('checkProfileFields', () => {
  it('normalises links, drops empty rows and blank email', () => {
    const r = checkProfileFields({
      links: [{ name: ' Site ', url: 'example.com' }, { name: '', url: ' ' }],
      contactEmail: '  ',
    });
    expect(r).toEqual({ links: [{ name: 'Site', url: 'https://example.com' }], contactEmail: null });
  });

  it.each([
    [[{ name: 'x', url: '' }], /URL/],
    [[{ name: '', url: 'https://a.com' }], /name/],
    [[{ name: 'x', url: 'javascript:alert(1)' }], /web address/],
    [[{ name: 'x', url: 'https://a b.com' }], /web address/],
    [[{ name: 'x'.repeat(41), url: 'https://a.com' }], /40/],
  ])('rejects links %j', (links, msg) => {
    const r = checkProfileFields({ links, contactEmail: '' });
    expect('error' in r && r.error).toMatch(msg);
  });

  it.each(['me', 'me@host', 'a b@c.d'])('rejects email %s', (email) => {
    const r = checkProfileFields({ links: [], contactEmail: email });
    expect('error' in r && r.error).toMatch(/email/);
  });

  it('accepts a normal email', () => {
    expect(checkProfileFields({ links: [], contactEmail: ' me@example.com ' })).toEqual({ links: [], contactEmail: 'me@example.com' });
  });
});

describe('profileSaveError', () => {
  it('hides raw constraint names', () => {
    expect(profileSaveError('new row for relation "profiles" violates check constraint "profiles_contact_email_check"')).not.toMatch(/relation/);
  });
});
