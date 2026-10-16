"use client";

import { useState, useTransition } from 'react';
import { moderateVersion } from '@/app/moderation/actions';

type Mode = 'reject' | 'decline';

const MODES: Record<Mode, { placeholder: string; missing: string; confirm: string; busy: string; className: string }> = {
  reject: {
    placeholder: "What should the uploader change? They'll see this note.",
    missing: 'Say what needs to change.',
    confirm: 'Send back with note',
    busy: 'Sending…',
    className: 'bg-amber-400/10 text-amber-200 border-amber-400/30 hover:bg-amber-400/20',
  },
  decline: {
    placeholder: "Why is this pack declined? The uploader will see this, and can't resubmit.",
    missing: 'Say why the pack is declined.',
    confirm: 'Decline pack',
    busy: 'Declining…',
    className: 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
  },
};

/**
 * Approve; request changes (the uploader can resubmit); or, for new packs,
 * decline (a final no). Sending back and declining both need a note.
 */
export default function ReviewActions({ versionId, slug, isUpdate = false }: { versionId: string; slug: string; isUpdate?: boolean }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: 'approve' | Mode) => {
    // Instant feedback; the server checks this too.
    if (action !== 'approve' && !notes.trim()) {
      setError(MODES[action].missing);
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await moderateVersion(versionId, slug, action, notes);
      if (!result.ok) setError(result.error);
    });
  };

  const secondary = 'px-4 py-2 rounded-lg text-sm font-medium bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50';

  return (
    <div className="flex flex-col gap-3">
      {mode && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder={MODES[mode].placeholder}
          className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm resize-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mode ? (
          <>
            <button
              onClick={() => run(mode)}
              disabled={pending}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${MODES[mode].className}`}
            >
              {pending ? MODES[mode].busy : MODES[mode].confirm}
            </button>
            <button onClick={() => { setMode(null); setError(null); }} disabled={pending} className={secondary}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => run('approve')}
              disabled={pending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black border border-white hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {pending ? 'Publishing…' : 'Approve & publish'}
            </button>
            <button onClick={() => setMode('reject')} disabled={pending} className={secondary}>
              Request changes
            </button>
            {/* Updates to published packs can't be declined: request changes, or take the pack down. */}
            {!isUpdate && (
              <button
                onClick={() => setMode('decline')}
                disabled={pending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
