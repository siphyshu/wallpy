// Browser side of submitting a pack: renditions, hashing, upload to R2, confirm,
// submit. Every step is re-checked by the server; this only gives early feedback.
import { encode as encodeBlurhash } from 'blurhash';
import { sha256Hex } from '@/lib/upload-client';
import { validateSchedule } from '@/lib/spec/validate';
import type { SubmissionInput } from '@/lib/packs/submission';
import type { ImageMime } from '@/lib/packs/limits';
import type { Schedule } from '@/lib/types';

type Upload = { name: string; blob: Blob; mime: ImageMime };
type Measured = Upload & { sha256: string; width: number; height: number; blurhash: string | null };
type Presigned =
  | { sha256: string; exists: true }
  | { sha256: string; exists: false; url: string; headers: Record<string, string>; ticket: string };
type Renditions = { thumb: string; preview: string };

export type Progress = { status: string; percent: number };

/** Rendition widths: thumbnails (gallery, filmstrip, schedule) and previews (the pack page's main viewer). */
const THUMB_WIDTH = 640;
const PREVIEW_WIDTH = 1920;

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

/** Downscaled WebP copy of a decoded image (the bitmap stays open). */
function rendition(bitmap: ImageBitmap, maxWidth: number): Promise<Blob> {
  const width = Math.min(maxWidth, bitmap.width);
  const height = Math.round((bitmap.height * width) / bitmap.width);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
}

/** Hash, size and blurhash of an upload. Decodes it unless `bitmap` is given. */
async function measure(upload: Upload, bitmap?: ImageBitmap): Promise<Measured> {
  const image = bitmap ?? await createImageBitmap(upload.blob);
  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, 32, 32);
  const blurhash = encodeBlurhash(ctx.getImageData(0, 0, 32, 32).data, 32, 32, 4, 3);
  const measured = { ...upload, sha256: await sha256Hex(upload.blob), width: image.width, height: image.height, blurhash };
  if (!bitmap) image.close();
  return measured;
}

/** An image and its two renditions, measured and hashed, from one decode. */
async function prepare(upload: Upload): Promise<{ original: Measured; thumb: Measured; preview: Measured }> {
  const bitmap = await createImageBitmap(upload.blob);
  try {
    const [thumb, preview] = await Promise.all([rendition(bitmap, THUMB_WIDTH), rendition(bitmap, PREVIEW_WIDTH)]);
    return {
      original: await measure(upload, bitmap),
      thumb: await measure({ name: `${upload.name} (thumbnail)`, blob: thumb, mime: 'image/webp' }),
      preview: await measure({ name: `${upload.name} (preview)`, blob: preview, mime: 'image/webp' }),
    };
  } finally {
    bitmap.close();
  }
}

/** An image in the draft: a new file, or one already in the pack (editing), with its renditions if it has them. */
export type DraftImage =
  | { name: string; file: File }
  | { name: string; existing: { sha256: string; url: string; thumbSha256?: string | null; previewSha256?: string | null } };

export type PackDraft = Omit<SubmissionInput, 'files' | 'schedule' | 'thumb_sha256' | 'preview_sha256'> & {
  schedule: Schedule;
  images: DraftImage[];
  /** filename of the image that represents the pack */
  cover: string;
};

/** Submitting a new version of an existing pack. */
export type VersionTarget = {
  slug: string;
  /** the version being changed: its renditions are reused while the cover stays the same */
  previous: { coverSha256: string | null; thumbSha256: string | null; previewSha256: string | null };
};

/**
 * Upload everything and submit: a new pack, or (with `target`) a new version
 * of one. Images already in the pack aren't uploaded again, and keep their
 * renditions. Resolves to the slug.
 */
export async function submitPack(
  draft: PackDraft,
  onProgress: (p: Progress) => void,
  target?: VersionTarget,
): Promise<{ slug: string; status: string }> {
  const errors = validateSchedule(draft.schedule, draft.images.map((i) => i.name));
  if (errors.length) throw new Error(errors[0]);

  onProgress({ status: 'Preparing images…', percent: 5 });
  const cover = draft.images.find((i) => i.name === draft.cover) ?? draft.images[0];
  const prev = target?.previous;
  const keepRenditions = 'existing' in cover && prev?.thumbSha256 && prev.previewSha256
    && cover.existing.sha256 === prev.coverSha256;

  // Every new image gets a thumbnail and a preview.
  const measured: Measured[] = [];
  const renditions = new Map<string, Renditions>();
  const fresh = draft.images.filter((i): i is Extract<DraftImage, { file: File }> => 'file' in i);
  for (const [n, i] of fresh.entries()) {
    const { original, thumb, preview } = await prepare({ name: i.name, blob: i.file, mime: i.file.type as ImageMime });
    measured.push(original, thumb, preview);
    renditions.set(i.name, { thumb: thumb.sha256, preview: preview.sha256 });
    onProgress({ status: `Preparing images (${n + 1}/${fresh.length})…`, percent: 5 + Math.round((15 * (n + 1)) / fresh.length) });
  }
  for (const i of draft.images) {
    if ('existing' in i && i.existing.thumbSha256 && i.existing.previewSha256) {
      renditions.set(i.name, { thumb: i.existing.thumbSha256, preview: i.existing.previewSha256 });
    }
  }

  // The pack's own thumbnail and preview are its cover's renditions.
  let coverRenditions: Renditions | undefined = keepRenditions
    ? { thumb: prev!.thumbSha256!, preview: prev!.previewSha256! }
    : renditions.get(cover.name);
  if (!coverRenditions && 'existing' in cover) {
    // An existing cover without renditions: make them. Fetched from the CDN,
    // bypassing the browser cache: <img> tags may have cached it without CORS headers.
    const source = await fetch(cover.existing.url, { cache: 'reload' }).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${cover.name} (${r.status})`);
      return r.blob();
    });
    const { thumb, preview } = await prepare({ name: cover.name, blob: source, mime: 'image/jpeg' });
    measured.push(thumb, preview);
    coverRenditions = { thumb: thumb.sha256, preview: preview.sha256 };
  }

  // The same bytes can appear twice (e.g. a small image's thumbnail and preview): upload each hash once.
  const unique = [...new Map(measured.map((m) => [m.sha256, m])).values()];

  if (unique.length) {
    onProgress({ status: 'Requesting upload links…', percent: 22 });
    const { files: presigned } = await readJson<{ files: Presigned[] }>(await fetch('/api/uploads/blobs/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: unique.map((m) => ({ sha256: m.sha256, size: m.blob.size, mime: m.mime })) }),
    }));

    const toUpload = presigned.filter((p): p is Extract<Presigned, { exists: false }> => !p.exists);
    let done = 0;
    await Promise.all(toUpload.map(async (p) => {
      const m = unique.find((u) => u.sha256 === p.sha256)!;
      const res = await fetch(p.url, { method: 'PUT', body: m.blob, headers: p.headers });
      if (!res.ok) throw new Error(`Uploading ${m.name} failed (${res.status})`);
      done += 1;
      onProgress({ status: `Uploading (${done}/${toUpload.length})…`, percent: 25 + Math.round((55 * done) / Math.max(toUpload.length, 1)) });
    }));

    onProgress({ status: 'Saving images…', percent: 82 });
    const tickets = new Map(toUpload.map((p) => [p.sha256, p.ticket]));
    await readJson(await fetch('/api/uploads/blobs/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: unique.map((m) => ({
          sha256: m.sha256, mime: m.mime, width: m.width, height: m.height, blurhash: m.blurhash,
          ...(tickets.has(m.sha256) ? { ticket: tickets.get(m.sha256) } : {}),
        })),
      }),
    }));
  }

  onProgress({ status: 'Submitting for review…', percent: 92 });
  const byName = new Map(measured.map((m) => [m.name, m.sha256]));
  const { images, schedule, ...rest } = draft;
  const result = await readJson<{ slug: string; status: string }>(await fetch(
    target ? `/api/packs/${encodeURIComponent(target.slug)}/versions` : '/api/packs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...rest,
        schedule,
        files: images.map((i) => {
          const r = renditions.get(i.name);
          return {
            path: i.name,
            sha256: 'existing' in i ? i.existing.sha256 : byName.get(i.name)!,
            ...(r ? { thumb_sha256: r.thumb, preview_sha256: r.preview } : {}),
          };
        }),
        cover: cover.name,
        thumb_sha256: coverRenditions?.thumb,
        preview_sha256: coverRenditions?.preview,
      } satisfies SubmissionInput),
    },
  ));
  onProgress({ status: 'Submitted for review', percent: 100 });
  return result;
}
