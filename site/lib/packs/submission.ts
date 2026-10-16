// A pack submission: what the upload wizard sends to POST /api/packs.
import { z } from 'zod';
import { PACK_LIMITS } from '@/lib/packs/limits';

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
