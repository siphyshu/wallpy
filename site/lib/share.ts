// The sky strip on a pack's share card: up to six of its images in schedule
// order, each with a label (the slot's label, or its days), coloured from the
// image's sky. Albums have no times, so they get one caption instead
// ("A new image every 20 minutes").
import type { PackKind, Schedule, Slot } from '@/lib/types';

export const STRIP_MAX = 6;

export type StripStop = { label: string; image: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Evenly spread picks that keep the first and the last. */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]);
}

function slotLabel(slot: Slot): string {
  if (slot.label?.trim()) return cap(slot.label.trim());
  if (slot.days?.length) return slot.days.map(cap).join(', ');
  return slot.at ?? '';
}

/** "every 20m" -> "A new image every 20 minutes"; anything else -> null. */
export function rotateCaption(rotate: string | undefined): string | null {
  const m = rotate?.match(/^every\s+(\d+)\s*([mhd])$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = { m: 'minute', h: 'hour', d: 'day' }[m[2] as 'm' | 'h' | 'd'];
  return n === 1 ? `A new image every ${unit}` : `A new image every ${n} ${unit}s`;
}

export function shareStrip(schedule: Schedule, kind: PackKind): { stops: StripStop[]; caption: string | null } {
  const slots = schedule.slot.filter((s) => s.images.length);
  if (kind === 'album') {
    const images = slots.flatMap((s) => s.images);
    return {
      stops: spread(images, STRIP_MAX).map((image) => ({ label: '', image })),
      caption: rotateCaption(slots[0]?.rotate) ?? `${images.length} images, one after another`,
    };
  }
  return { stops: spread(slots, STRIP_MAX).map((s) => ({ label: slotLabel(s), image: s.images[0] })), caption: null };
}
