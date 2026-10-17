import { describeDays, describeInterval } from '@/lib/spec/describe';
import type { Database } from '@/lib/database.types';
import type { Schedule } from '@/lib/types';

// Pure helpers for moderators: report reasons, schedule summaries and what an
// update changes against the live version. Shared by server pages and the
// report form (so no server imports here).

export type ReportReason = Database['public']['Enums']['report_reason'];

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
  { id: 'not_wallpaper', label: 'Not a wallpaper' },
  { id: 'stolen', label: 'Stolen or uncredited' },
  { id: 'ai_undisclosed', label: 'AI use not disclosed' },
  { id: 'offensive', label: 'Offensive' },
  { id: 'broken', label: 'Broken' },
  { id: 'other', label: 'Other' },
];

export const REPORT_NOTE_MAX = 500;

export function reportReasonLabel(id: ReportReason): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}

/** One line per slot: "Sunrise · sunrise · every day · 2 images (day.jpg, …) · every 1h". */
export function scheduleSummary(schedule: Pick<Schedule, 'slot'> | null | undefined): string[] {
  return (schedule?.slot ?? []).map((s, i) => {
    const parts = [s.label?.trim() || `Slot ${i + 1}`];
    if (s.at) parts.push(`at ${s.at}`);
    if (s.days?.length) parts.push(describeDays(s.days));
    const shown = s.images.slice(0, 3).join(', ') + (s.images.length > 3 ? ', …' : '');
    parts.push(`${s.images.length} ${s.images.length === 1 ? 'image' : 'images'} (${shown})`);
    if (s.rotate && s.rotate !== 'spread') parts.push(describeInterval(s.rotate));
    if (s.shuffle) parts.push('shuffled');
    return parts.join(' · ');
  });
}

/** The parts of a version a moderator compares. */
export type VersionSnapshot = {
  title: string;
  description: string | null;
  categories: string[];
  tags: string[];
  license: string;
  licenseNotes: string | null;
  aiUse: string | null;
  schedule: Pick<Schedule, 'slot'> | null;
  /** image path -> sha256 */
  files: { path: string; sha256: string }[];
};

export type FieldChange = { field: string; before: string; after: string };

export type VersionDiff = {
  fields: FieldChange[];
  /** paths new in the update, or whose content changed */
  added: string[];
  /** paths the update drops */
  removed: string[];
  /** set when the schedule changed: before and after summaries */
  schedule: { before: string[]; after: string[] } | null;
};

const list = (values: string[]) => (values.length ? values.join(', ') : 'none');
const text = (value: string | null) => (value?.trim() ? value.trim() : 'none');

export function diffVersions(live: VersionSnapshot, next: VersionSnapshot): VersionDiff {
  const fields: FieldChange[] = [];
  const compare = (field: string, before: string, after: string) => {
    if (before !== after) fields.push({ field, before, after });
  };
  compare('Title', live.title, next.title);
  compare('Description', text(live.description), text(next.description));
  compare('Categories', list([...live.categories].sort()), list([...next.categories].sort()));
  compare('Tags', list([...live.tags].sort()), list([...next.tags].sort()));
  compare('Licence', live.license, next.license);
  compare('Licence notes', text(live.licenseNotes), text(next.licenseNotes));
  compare('AI use', live.aiUse ?? 'not disclosed', next.aiUse ?? 'not disclosed');

  const before = new Map(live.files.map((f) => [f.path.toLowerCase(), f.sha256]));
  const after = new Map(next.files.map((f) => [f.path.toLowerCase(), f.sha256]));
  const added = next.files.filter((f) => before.get(f.path.toLowerCase()) !== f.sha256).map((f) => f.path);
  const removed = live.files
    .filter((f) => !after.has(f.path.toLowerCase()) || after.get(f.path.toLowerCase()) !== f.sha256)
    .map((f) => f.path);

  const beforeSchedule = scheduleSummary(live.schedule);
  const afterSchedule = scheduleSummary(next.schedule);
  const schedule = beforeSchedule.join('\n') === afterSchedule.join('\n') ? null : { before: beforeSchedule, after: afterSchedule };

  return { fields, added, removed, schedule };
}

export function isEmptyDiff(d: VersionDiff): boolean {
  return !d.fields.length && !d.added.length && !d.removed.length && !d.schedule;
}
