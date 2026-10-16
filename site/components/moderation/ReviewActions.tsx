"use client";

import { useState, useTransition } from 'react';
import { moderateVersion } from '@/app/moderation/actions';

/** Approve, or reject with a note for the uploader. */
export default function ReviewActions({ versionId, slug }: { versionId: string; slug: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: 'approve' | 'reject') => {
    // Instant feedback; the server checks this too.
    if (action === 'reject' && !notes.trim()) {
      setError('Say what needs to change.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await moderateVersion(versionId, slug, action, notes);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {rejecting && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder="What should the uploader change? They'll see this note."
          className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm resize-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {rejecting ? (
          <>
            <button
              onClick={() => run('reject')}
              disabled={pending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send back with note'}
            </button>
            <button
              onClick={() => { setRejecting(false); setError(null); }}
              disabled={pending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
            >
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
            <button
              onClick={() => setRejecting(true)}
              disabled={pending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              Request changes
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
