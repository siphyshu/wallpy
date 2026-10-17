"use client";

import { useState, useTransition } from 'react';
import { dismissReports, setPackRemoved } from '@/app/moderation/actions';

type Mode = 'takedown' | 'restore';

const BUTTON = 'px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50';
const SECONDARY = `${BUTTON} bg-white/10 border-white/20 hover:bg-white/20`;
const DANGER = `${BUTTON} bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20`;

/**
 * Moderator controls for a published pack: take it down (reason required; the
 * owner sees it), restore it, or dismiss its open reports.
 */
export default function PackModActions({ versionId, packId, slug, removed, openReports = 0 }: {
  versionId: string;
  packId: string;
  slug: string;
  removed: boolean;
  openReports?: number;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (!reason.trim()) {
      setError(mode === 'takedown' ? 'Say why the pack is taken down.' : 'Say why the pack is restored.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await setPackRemoved(versionId, slug, mode === 'takedown', reason);
      if (result.ok) { setMode(null); setReason(''); } else setError(result.error);
    });
  };

  const dismiss = () => startTransition(async () => {
    setError(null);
    const result = await dismissReports(packId);
    if (!result.ok) setError(result.error);
  });

  return (
    <div className="flex flex-col gap-3">
      {mode && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder={mode === 'takedown'
            ? "Why is this pack taken down? The owner will see this."
            : 'Why is this pack restored? Kept in the moderation log.'}
          className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm resize-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mode ? (
          <>
            <button onClick={confirm} disabled={pending} className={mode === 'takedown' ? DANGER : SECONDARY}>
              {pending ? 'Saving…' : mode === 'takedown' ? 'Take down pack' : 'Restore pack'}
            </button>
            <button onClick={() => { setMode(null); setError(null); }} disabled={pending} className={SECONDARY}>Cancel</button>
          </>
        ) : (
          <>
            {removed ? (
              <button onClick={() => setMode('restore')} disabled={pending} className={SECONDARY}>Restore</button>
            ) : (
              <button onClick={() => setMode('takedown')} disabled={pending} className={DANGER}>Take down</button>
            )}
            {openReports > 0 && (
              <button onClick={dismiss} disabled={pending} className={SECONDARY}>
                {pending ? 'Dismissing…' : `Dismiss ${openReports === 1 ? 'report' : `${openReports} reports`}`}
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
