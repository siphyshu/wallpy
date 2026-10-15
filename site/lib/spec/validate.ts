// Spec 2 validation: the JSON Schema plus spec/README.md "Rules beyond the JSON
// Schema". Ported from spec/reference/wallpy_ref.py. Runs in the browser (live
// feedback while building a pack) and on the server (authoritative, on submit).
import Ajv2020 from 'ajv/dist/2020';
import schema from '@/lib/spec/schedule.schema.json';
import { everyMs, fallbackMinutes, parseAt, WEEKDAYS } from '@/lib/spec/time';
import type { Schedule } from '@/lib/types';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const checkSchema = ajv.compile(schema);

/** [] when valid. `packFiles`, when given, must match the images the schedule names. */
export function validateSchedule(schedule: unknown, packFiles?: string[]): string[] {
  if (!checkSchema(schedule)) {
    return (checkSchema.errors ?? []).map((e) => `${e.instancePath || '(root)'}: ${e.message}`);
  }
  const s = schedule as Schedule;
  const errors: string[] = [];

  s.slot.forEach((slot, i) => {
    const every = everyMs(slot.rotate ?? 'spread');
    if (every !== null && (every < 5 * 60_000 || every > 7 * 86_400_000)) {
      errors.push(`slot ${i + 1}: rotation interval must be between 5 minutes and 7 days`);
    }
    if (slot.at) {
      const p = parseAt(slot.at);
      if (p.kind === 'solar' && Math.abs(p.offsetMinutes) > 12 * 60) {
        errors.push(`slot ${i + 1}: offset must be at most 12 hours`);
      }
    }
  });

  for (const day of WEEKDAYS) {
    const applicable = s.slot.map((slot, i) => [i, slot] as const).filter(([, slot]) => (slot.days ?? WEEKDAYS).includes(day));
    if (!applicable.length) {
      errors.push(`no slot applies on ${day}`);
      continue;
    }
    const seen = new Map<string, number>();
    let previous: [number, number] | null = null;
    for (const [i, slot] of applicable) {
      const at = slot.at ?? '00:00';
      if (seen.has(at)) errors.push(`slot ${i + 1} starts at "${at}" on ${day}, like slot ${seen.get(at)! + 1}`);
      seen.set(at, i);
      const minutes = fallbackMinutes(at);
      if (previous && minutes < previous[1]) {
        errors.push(`slot ${i + 1} ("${at}") is listed after slot ${previous[0] + 1} but starts earlier on ${day}; keep slots in time order`);
      }
      previous = [i, minutes];
    }
  }

  if (packFiles) {
    const named = new Set(s.slot.flatMap((slot) => slot.images));
    const files = new Set(packFiles);
    for (const img of named) if (!files.has(img)) errors.push(`image "${img}" is not in the pack`);
    for (const f of files) if (!named.has(f)) errors.push(`image "${f}" is in the pack but not used`);
    const lower = packFiles.map((f) => f.toLowerCase());
    for (const f of files) if (lower.filter((x) => x === f.toLowerCase()).length > 1) errors.push(`filenames differ only by case: "${f}"`);
  }
  return [...new Set(errors)];
}
