import { describe, expect, it } from 'vitest';
import { PUBLIC_KEY_PATTERN } from '@/lib/storage';

const sha = 'a'.repeat(64);
const uid = '87c688a6-583a-491b-b7e9-5883787a771d';

// The dev file proxy only serves keys matching this pattern, so it can't be
// used to read anything else in the bucket.
describe('PUBLIC_KEY_PATTERN', () => {
  it.each([`blobs/${sha}`, `profiles/${uid}/${sha}.jpg`, `artists/${sha}.png`])('allows %s', (key) => {
    expect(PUBLIC_KEY_PATTERN.test(key)).toBe(true);
  });

  it.each([
    'recovered/MANIFEST.md5',
    'archive/wallpy-site-checkpoint.zip',
    `blobs/${sha}/../../secret`,
    `blobs/${sha.slice(1)}`,
    `profiles/${uid}/${sha}.html`,
    `profiles/../${sha}.jpg`,
    `artists/${sha}.svg`,
    '',
  ])('rejects %s', (key) => {
    expect(PUBLIC_KEY_PATTERN.test(key)).toBe(false);
  });
});
