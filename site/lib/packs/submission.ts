// A pack submission: what the upload wizard sends to POST /api/packs.
import { z } from 'zod';
import { PACK_LIMITS, normalizeTag } from '@/lib/packs/limits';
import { validateSchedule } from '@/lib/spec/validate';
import type { Json } from '@/lib/database.types';

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const imageName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}\.(jpg|jpeg|png|webp)$/, 'unsupported file name');

export const Submission = z
  .object({
    title: z.string().trim().min(1, 'Give the pack a title').max(PACK_LIMITS.titleMax),
    description: z.string().trim().max(PACK_LIMITS.descriptionMax).optional().default(''),
    tags: z.array(z.string()).max(PACK_LIMITS.maxTags).default([]),
    license: z.enum(['personal-use', 'cc-by-4.0', 'cc-by-nc-4.0', 'cc0', 'other']).default('personal-use'),
    license_notes: z.string().trim().max(500).optional().default(''),
    ai_use: z.enum(['none', 'assisted', 'generated'], { message: 'Say whether AI was used to make these images' }),
    uploader_is_artist: z.boolean(),
    artist: z
      .object({ name: z.string().trim().min(1).max(80), url: z.string().trim().url().max(300).or(z.literal('')).optional() })
      .nullable()
      .default(null),
    /** spec 2 schedule; fully validated by lib/spec/validate.ts on the server */
    schedule: z.unknown(),
    files: z.array(z.object({ path: imageName, sha256 })).min(1).max(PACK_LIMITS.maxFiles),
    cover: imageName.optional(),
    thumb_sha256: sha256.optional(),
    preview_sha256: sha256.optional(),
  })
  .refine((s) => s.uploader_is_artist || s.artist, {
    message: 'Credit the artist, or say that you made it',
    path: ['artist'],
  });

export type SubmissionInput = z.input<typeof Submission>;

/** What create_pack() / create_version() take: a parsed submission, tidied. */
export function toRpcPayload(s: z.output<typeof Submission>) {
  return {
    title: s.title,
    description: s.description,
    tags: [...new Set(s.tags.map(normalizeTag).filter(Boolean))],
    license: s.license,
    license_notes: s.license_notes,
    ai_use: s.ai_use,
    uploader_is_artist: s.uploader_is_artist,
    artist: s.uploader_is_artist ? null : s.artist,
    schedule: s.schedule as Json,
    files: s.files,
    cover: s.cover,
    thumb_sha256: s.thumb_sha256,
    preview_sha256: s.preview_sha256,
    submit: true,
  };
}

/** Parse and fully validate a submission body (schema, then the pack spec). */
export function parseSubmission(body: unknown):
  | { ok: true; submission: z.output<typeof Submission> }
  | { ok: false; error: string; issues: unknown } {
  const parsed = Submission.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid submission.', issues: parsed.error.issues };
  }
  const problems = validateSchedule(parsed.data.schedule, parsed.data.files.map((f) => f.path));
  if (problems.length) return { ok: false, error: problems[0], issues: problems };
  return { ok: true, submission: parsed.data };
}
