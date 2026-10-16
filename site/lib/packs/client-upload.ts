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

export type Progress = { status: string; percent: number };

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/** Downscaled WebP copy, for gallery thumbnails and the pack page. */
async function rendition(source: Blob, maxWidth: number): Promise<Blob> {
  const bitmap = await decode(source);
  const width = Math.min(maxWidth, bitmap.width);
  const height = Math.round((bitmap.height * width) / bitmap.width);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
}

async function measure(upload: Upload, withBlurhash: boolean): Promise<Measured> {
  const bitmap = await decode(upload.blob);
  let blurhash: string | null = null;
  if (withBlurhash) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    blurhash = encodeBlurhash(ctx.getImageData(0, 0, 32, 32).data, 32, 32, 4, 3);
  }
  const measured = { ...upload, sha256: await sha256Hex(upload.blob), width: bitmap.width, height: bitmap.height, blurhash };
  bitmap.close();
  return measured;
}

export type PackDraft = Omit<SubmissionInput, 'files' | 'schedule' | 'thumb_sha256' | 'preview_sha256'> & {
  schedule: Schedule;
  images: { name: string; file: File }[];
  /** filename of the image that represents the pack */
  cover: string;
};

/** Upload everything and submit. Resolves to the new pack's slug. */
export async function submitPack(draft: PackDraft, onProgress: (p: Progress) => void): Promise<{ slug: string; status: string }> {
  const errors = validateSchedule(draft.schedule, draft.images.map((i) => i.name));
  if (errors.length) throw new Error(errors[0]);

  onProgress({ status: 'Preparing images…', percent: 5 });
  const cover = draft.images.find((i) => i.name === draft.cover) ?? draft.images[0];
  const [thumb, preview] = await Promise.all([rendition(cover.file, 640), rendition(cover.file, 1920)]);
  const uploads: Upload[] = [
    ...draft.images.map((i) => ({ name: i.name, blob: i.file as Blob, mime: i.file.type as ImageMime })),
    { name: '(thumbnail)', blob: thumb, mime: 'image/webp' },
    { name: '(preview)', blob: preview, mime: 'image/webp' },
  ];
  const measured: Measured[] = [];
  for (const [n, u] of uploads.entries()) {
    measured.push(await measure(u, u.name === '(thumbnail)' || u.name === '(preview)' || u.name === cover.name));
    onProgress({ status: `Checking images (${n + 1}/${uploads.length})…`, percent: 5 + Math.round((15 * (n + 1)) / uploads.length) });
  }
  // The same image can appear twice (e.g. the cover as a rendition source): upload each hash once.
  const unique = [...new Map(measured.map((m) => [m.sha256, m])).values()];

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

  onProgress({ status: 'Submitting for review…', percent: 92 });
  const byName = new Map(measured.map((m) => [m.name, m]));
  const { images, schedule, ...rest } = draft;
  const result = await readJson<{ slug: string; status: string }>(await fetch('/api/packs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...rest,
      schedule,
      files: images.map((i) => ({ path: i.name, sha256: byName.get(i.name)!.sha256 })),
      cover: cover.name,
      thumb_sha256: byName.get('(thumbnail)')!.sha256,
      preview_sha256: byName.get('(preview)')!.sha256,
    } satisfies SubmissionInput),
  }));
  onProgress({ status: 'Submitted for review', percent: 100 });
  return result;
}
