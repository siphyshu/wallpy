"use client"

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { active, daySegments, slotTimes, type Active } from '@/lib/spec/scheduler';
import { parseAt, resolveAt, toWall, wallDay, weekdayOf, WEEKDAYS } from '@/lib/spec/time';
import { DAY_NAMES, describeDays, describeInterval, displayLabel, type BuilderKind } from '@/lib/spec/describe';
import type { PackFile, PackKind, Schedule, Slot } from '@/lib/types';

const KINDS: Record<PackKind, BuilderKind> = { timeblocks: 'daypack', days: 'weekpack', album: 'album' };

// Any day works for the times (they're the fallback solar times, the same
// every day); a fixed one keeps the server and browser renders identical.
const REFERENCE_DAY = Date.UTC(2026, 0, 5); // a Monday

/** What the visitor's clock says now, and what the pack shows at that moment. */
type Now = { wall: number; active: Active | null };

function useNow(schedule: Schedule): Now | null {
  const [now, setNow] = useState<Now | null>(null);
  useEffect(() => {
    let cancelled = false;
    const update = () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const instant = Date.now();
      const wall = toWall(instant, timezone);
      active(schedule, instant, timezone, null)
        .then((a) => { if (!cancelled) setNow({ wall, active: a }); })
        .catch(() => { if (!cancelled) setNow({ wall, active: null }); });
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [schedule]);
  return now;
}

/** "05:00" from a wall timestamp. */
function clock(wall: number): string {
  const d = new Date(wall);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "dawn", "sunrise+30m": the solar event behind a start time, if any. */
function solarEvent(at: string | undefined): string | null {
  try {
    return at && parseAt(at).kind === 'solar' ? at : null;
  } catch {
    return null;
  }
}

/** How a slot's images take turns, in words. */
function rotation(slot: Slot, across: string): string {
  const n = slot.images.length;
  if (n === 1) return '1 image';
  const how = slot.rotate?.startsWith('every ') ? `changes every ${describeInterval(slot.rotate)}` : `spread across ${across}`;
  return `${n} images, ${how}${slot.shuffle ? ', shuffled' : ''}`;
}

/** Muted sky colour for a time of day (minutes after midnight), like the CLI's sky strip. */
function sky(minute: number): string {
  if (minute < 300 || minute >= 1230) return 'bg-indigo-950/70';
  if (minute < 420 || minute >= 1080) return 'bg-orange-300/25';
  return 'bg-sky-300/20';
}

function NowPill({ children = 'Now' }: { children?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-black">
      <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden />
      {children}
    </span>
  );
}

function Thumbs({ names, files, selected, onSelect, showing }: {
  names: string[];
  files: Map<string, PackFile>;
  selected: PackFile | null;
  onSelect: (f: PackFile) => void;
  /** the image on screen now, if it's one of these */
  showing?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
      {names.map((name, i) => {
        const file = files.get(name);
        if (!file) return null;
        const isSelected = selected?.id === file.id;
        return (
          <button
            key={`${name}-${i}`}
            type="button"
            onClick={() => onSelect(file)}
            title={name}
            aria-label={`Show ${name}`}
            aria-pressed={isSelected}
            className={`relative w-full md:w-auto md:h-16 aspect-video rounded-md overflow-hidden bg-white/5 border-2 transition-all ${
              isSelected ? 'border-white' : 'border-transparent opacity-80 hover:opacity-100'
            }`}
          >
            <Image src={file.thumbUrl} alt="" fill sizes="160px" unoptimized={file.thumbUrl !== file.url} className="object-cover" />
            {showing === name && (
              <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-px text-[10px] font-medium text-white">Now</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  schedule: Schedule;
  kind: PackKind;
  files: PackFile[];
  selected: PackFile | null;
  onSelect: (f: PackFile) => void;
};
type Inner = Omit<Props, 'files'> & { files: Map<string, PackFile>; now: Now | null };

/** Daypack: a 24-hour strip and the blocks through the day. */
function DaySchedule({ schedule, files, selected, onSelect, now }: Inner) {
  const runs = useMemo(() => daySegments(schedule, REFERENCE_DAY), [schedule]);
  const blocks = useMemo(() => slotTimes(schedule, REFERENCE_DAY), [schedule]);
  const minute = now ? (now.wall - wallDay(now.wall)) / 60_000 : null;
  const current = now?.active?.slot;
  const label = (i: number) => displayLabel({ label: schedule.slot[i].label ?? '', at: schedule.slot[i].at }, 'daypack', i);

  return (
    <>
      <div className="mb-8">
        <div className="relative pt-6">
          {minute !== null && (
            <div className="absolute top-0 bottom-0 z-10 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                 style={{ left: `${(minute / 1440) * 100}%` }}>
              <span className="text-[11px] font-medium text-white whitespace-nowrap">Now {clock(now!.wall)}</span>
              <span className="w-px flex-1 bg-white" />
            </div>
          )}
          <div className="flex h-10 rounded-md overflow-hidden border border-white/10">
            {runs.map((r) => {
              const from = (r.from - REFERENCE_DAY) / 60_000;
              const to = (r.to - REFERENCE_DAY) / 60_000;
              return (
                <div
                  key={`${r.slot}-${r.from}`}
                  title={`${label(r.slot)} · ${clock(r.from)}–${clock(r.to)}`}
                  className={`${sky((from + to) / 2)} h-full border-r border-black/40 last:border-r-0 flex items-center px-2 min-w-0 ${
                    current === r.slot ? 'ring-1 ring-inset ring-white/70' : ''
                  }`}
                  style={{ width: `${((to - from) / 1440) * 100}%` }}
                >
                  <span className="hidden md:block truncate text-[11px] text-white/80">{label(r.slot)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-white/40">
          {['00:00', '06:00', '12:00', '18:00', '24:00'].map((t) => <span key={t}>{t}</span>)}
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {blocks.map((b) => {
          const slot = schedule.slot[b.slot];
          const isNow = current === b.slot;
          const startEvent = solarEvent(slot.at);
          const next = blocks.find((x) => x.from === b.to) ?? blocks[0];
          const endEvent = solarEvent(schedule.slot[next.slot].at);
          return (
            <li key={b.slot} className={`grid grid-cols-1 md:grid-cols-[8rem_1fr] gap-2 md:gap-4 p-3 md:p-4 rounded-lg border ${
              isNow ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'
            }`}>
              <div className="text-sm text-white/80 tabular-nums flex flex-wrap items-baseline gap-x-2 md:block">
                <div>{clock(b.from)}–{clock(b.to)}</div>
                {startEvent && <div className="text-[11px] text-white/40 truncate" title={`from ${startEvent}`}>from {startEvent}</div>}
                {endEvent && <div className="text-[11px] text-white/40 truncate" title={`until ${endEvent}`}>until {endEvent}</div>}
              </div>
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{label(b.slot)}</span>
                  {isNow && <NowPill />}
                  <span className="text-xs text-white/50">{rotation(slot, 'the block')}</span>
                </div>
                <Thumbs names={slot.images} files={files} selected={selected} onSelect={onSelect}
                        showing={isNow ? now?.active?.image : undefined} />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Weekpack: the week, and each day group with its images. */
function WeekSchedule({ schedule, files, selected, onSelect, now }: Inner) {
  const today = now ? weekdayOf(wallDay(now.wall)) : null;
  const current = now?.active?.slot;
  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-6">
        {WEEKDAYS.map((d) => (
          <div key={d} className={`rounded-lg p-2 text-center text-xs font-medium ${
            d === today ? 'bg-white text-black' : 'bg-white/10 text-white/70'
          }`} title={DAY_NAMES[d]}>
            {DAY_NAMES[d].slice(0, 3)}
            {d === today && <div className="text-[10px] font-normal text-black/60">Today</div>}
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-2">
        {schedule.slot.map((slot, i) => {
          const isNow = current === i;
          const from = slot.at && slot.at !== '00:00' && slot.at !== 'midnight' ? slot.at : null;
          const fromClock = from ? clock(resolveAt(from, REFERENCE_DAY, null)) : null;
          return (
            <li key={i} className={`grid grid-cols-1 md:grid-cols-[8rem_1fr] gap-2 md:gap-4 p-3 md:p-4 rounded-lg border ${
              isNow ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'
            }`}>
              <div className="text-sm text-white/80 flex flex-wrap items-baseline gap-x-2 md:block">
                <div>{describeDays(slot.days)}</div>
                {from && <div className="text-[11px] text-white/40 truncate" title={from}>from {fromClock}{solarEvent(from) ? ` (${from})` : ''}</div>}
              </div>
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{displayLabel({ label: slot.label ?? '', days: slot.days }, 'weekpack', i)}</span>
                  {isNow && <NowPill>{from ? 'Now' : 'Today'}</NowPill>}
                  <span className="text-xs text-white/50">{rotation(slot, 'the day')}</span>
                </div>
                <Thumbs names={slot.images} files={files} selected={selected} onSelect={onSelect}
                        showing={isNow ? now?.active?.image : undefined} />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Album: every image in order, and how often it changes. */
function AlbumSchedule({ schedule, files, selected, onSelect, now }: Inner) {
  return (
    <ol className="flex flex-col gap-6">
      {schedule.slot.map((slot, i) => (
        <li key={i} className="flex flex-col gap-3">
          <p className="text-sm text-white/70">
            {slot.images.length === 1 ? 'One image.' : (
              <>
                {slot.rotate?.startsWith('every ') ? `Changes every ${describeInterval(slot.rotate)}` : 'Changes through the day'}
                {slot.shuffle ? ', in a shuffled order (a new order each time round).' : ', in this order.'}
              </>
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {slot.images.map((name, k) => {
              const file = files.get(name);
              if (!file) return null;
              const isSelected = selected?.id === file.id;
              const isNow = now?.active?.slot === i && now.active.image === name;
              return (
                <button
                  key={`${name}-${k}`}
                  type="button"
                  onClick={() => onSelect(file)}
                  title={name}
                  aria-label={`Show ${name}`}
                  aria-pressed={isSelected}
                  className={`relative aspect-video rounded-lg overflow-hidden bg-white/5 border-2 transition-all ${
                    isSelected ? 'border-white' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  <Image src={file.thumbUrl} alt="" fill sizes="(min-width: 1024px) 20vw, 45vw" unoptimized={file.thumbUrl !== file.url} className="object-cover" />
                  {!slot.shuffle && (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-px text-[10px] font-medium text-white tabular-nums">{k + 1}</span>
                  )}
                  {isNow && <span className="absolute bottom-1.5 left-1.5"><NowPill /></span>}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

const INTROS: Record<BuilderKind, string> = {
  daypack: 'What shows through the day. Wallpy follows your location’s real sunrise and sunset; times here are typical ones.',
  weekpack: 'What shows on each day of the week.',
  album: 'The images take turns on a timer.',
};

/** The pack's schedule: what shows when, with the image on screen now marked (visitor's clock). */
export default function PackSchedule(props: Props) {
  const { schedule, kind, files } = props;
  const now = useNow(schedule);
  const byPath = useMemo(() => new Map(files.map((f) => [f.path, f])), [files]);
  const builderKind = KINDS[kind];
  if (!schedule?.slot?.length) return null;
  const inner = { ...props, files: byPath, now };

  return (
    <section aria-labelledby="schedule-heading" className="mt-16">
      <h2 id="schedule-heading" className="text-2xl font-serif mb-1">Schedule</h2>
      <p className="text-sm text-white/60 mb-6">{INTROS[builderKind]}</p>
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 md:p-6">
        {builderKind === 'daypack' && <DaySchedule {...inner} />}
        {builderKind === 'weekpack' && <WeekSchedule {...inner} />}
        {builderKind === 'album' && <AlbumSchedule {...inner} />}
      </div>
    </section>
  );
}
