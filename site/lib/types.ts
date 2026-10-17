// Shapes the site passes around. Database rows are typed by the generated
// lib/database.types.ts; these are what the data layer turns them into.
import type { Database } from '@/lib/database.types';

type Enums = Database['public']['Enums'];
export type PackKind = Enums['pack_kind'];
export type VersionStatus = Enums['version_status'];
export type PackLicense = Enums['pack_license'];
export type UserRole = Enums['user_role'];
export type AiUse = Enums['ai_use'];
export type PackCategory = Enums['pack_category'];

export type ProfileLink = { name: string; url: string };

export type Profile = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  website: string | null;
  links: ProfileLink[];
  contact_email: string | null;
  avatar_key: string | null;
  cover_key: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: UserRole;
  created_at: string;
};

/** Who a pack is credited to: the uploader if they made it, else the artist. */
export type Credit = {
  name: string;
  url: string | null;
  avatar: string;
  /** true when `url` is a profile on this site */
  internal: boolean;
};

/** What a gallery card renders. */
export type PackCard = {
  id: string;
  slug: string;
  name: string;
  url: string;
  preview: string;
  blurhash: string | null;
  author: string;
  author_url: string | null;
  author_profile: string;
  downloads: number;
  favourites: number;
  createdAt: string;
  category: PackKind | null;
  kindLabel: string;
  /** null: not disclosed (older uploads) */
  aiUse: AiUse | null;
  status: VersionStatus | null;
  isPublic: boolean;
  /** owner's view only: the newest version is in review, sent back, or declined */
  review?: 'pending' | 'rejected' | 'declined';
};

export type PackFile = {
  id: string;
  path: string;
  sha256: string;
  size: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  /** the original: what the CLI downloads */
  url: string;
  /** 640px WebP rendition, or the original for files uploaded without one */
  thumbUrl: string;
  /** 1920px WebP rendition, or the original */
  previewUrl: string;
};

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** One [[slot]] of a spec 2 schedule (spec/schedule.schema.json). */
export type Slot = {
  label?: string;
  /** "08:30" or a solar event like "sunrise+1h30m"; default "00:00" */
  at?: string;
  /** default: every day */
  days?: Weekday[];
  images: string[];
  /** "spread" (default) or "every <n><m|h|d>" */
  rotate?: string;
  shuffle?: boolean;
};

/** A spec 2 schedule. Validated on write (DB check + server validator). */
export type Schedule = {
  spec: 2;
  name: string;
  author?: string;
  description?: string;
  slot: Slot[];
};

export type PackDetail = PackCard & {
  ownerId: string;
  owner: { username: string; display_name: string | null; avatar_key: string | null } | null;
  removedAt: string | null;
  removedReason: string | null;
  version: {
    id: string;
    number: number;
    status: VersionStatus;
    title: string;
    description: string | null;
    tags: string[];
    categories: PackCategory[];
    kind: PackKind;
    schedule: Schedule;
    license: PackLicense;
    licenseNotes: string | null;
    aiUse: AiUse | null;
    createdAt: string;
  };
  credit: Credit;
  previewUrl: string | null;
  previewBlurhash: string | null;
  cover: PackFile | undefined;
  files: PackFile[];
};

/**
 * GET /api/packs/<slug>/manifest. The contract between the site and the CLI:
 * change it only together with the CLI's reader.
 */
export type Manifest = {
  manifest: 1;
  slug: string;
  version: number;
  status: VersionStatus;
  title: string;
  kind: PackKind;
  credit: { name: string; url: string | null };
  license: PackLicense;
  aiUse: AiUse | null;
  schedule: Schedule;
  files: { path: string; sha256: string; size: number; url: string }[];
};
