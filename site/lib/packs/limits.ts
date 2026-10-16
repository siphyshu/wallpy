// Upload limits, shared by the browser (early feedback) and the server (enforced).
export const PACK_LIMITS = {
  maxFiles: 100,
  maxFileBytes: 30 * 1024 * 1024, // matches the blobs.size check constraint
  maxTags: 10,
  titleMax: 80,
  descriptionMax: 2000,
} as const;

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

/** "Ocean Hours!" -> "ocean-hours" (the server adds -2, -3 if taken). */
export function slugify(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56)
      .replace(/-+$/, '') || 'pack'
  );
}

/** "Digital Art" -> "digital-art" (tags are kebab-case in the database). */
export function normalizeTag(tag: string): string {
  return slugify(tag).slice(0, 30);
}
