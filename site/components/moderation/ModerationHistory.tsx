import type { HistoryEntry } from '@/lib/data/moderation';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** A pack's moderation log, for moderators. Collapsed by default. */
export default function ModerationHistory({ entries, open = false }: { entries: HistoryEntry[]; open?: boolean }) {
  if (!entries.length) return null;
  return (
    <details open={open} className="group text-sm" data-testid="moderation-history">
      <summary className="cursor-pointer select-none text-xs text-white/50 hover:text-white">
        Moderation history ({entries.length})
      </summary>
      <ol className="mt-2 flex flex-col gap-1.5 border-l border-white/10 pl-3">
        {entries.map((e, i) => (
          <li key={i} className="text-white/70">
            <span className="text-white/40 text-xs">{when(e.at)}</span>{' '}
            <span className="text-white">{e.actor ? `@${e.actor}` : 'deleted user'}</span> {e.action}
            {e.version !== null && <span className="text-white/40"> · v{e.version}</span>}
            {e.note && <span className="block text-white/60 text-xs">&ldquo;{e.note}&rdquo;</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
