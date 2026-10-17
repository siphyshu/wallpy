// Upload limits, shared by the browser (early feedback) and the server (enforced).
export const PACK_LIMITS = {
  maxFiles: 100,
  /** blobs in one upload: every image plus its thumbnail and preview, plus the cover's if it lacks them */
  maxUploadBlobs: 100 * 3 + 2,
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

/**
 * A filename the pack spec accepts (letters, digits, space . _ -, a lowercase
 * jpg/jpeg/png/webp extension), unique among `taken` ignoring case.
 * "IMG 01 (copy).JPG" -> "IMG 01 copy.jpg".
 */
export function safeImageName(original: string, taken: Iterable<string> = []): string {
  const dot = original.lastIndexOf('.');
  const ext = (dot > 0 ? original.slice(dot + 1) : 'jpg').toLowerCase();
  const stem = (dot > 0 ? original.slice(0, dot) : original)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 90) || 'image';
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  let name = `${stem}.${ext}`;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem}-${n}.${ext}`;
  return name;
}
