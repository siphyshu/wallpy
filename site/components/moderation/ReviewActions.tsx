"use client";

import { useState, useTransition } from 'react';
import { moderateVersion } from '@/app/moderation/actions';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

type Mode = 'reject' | 'decline';

const MODES: Record<Mode, { placeholder: string; missing: string; confirm: string; busy: string; variant: ButtonVariant; className?: string }> = {
  reject: {
    placeholder: "What should the uploader change? They'll see this note.",
    missing: 'Say what needs to change.',
    confirm: 'Send back with note',
    busy: 'Sending…',
    // Amber: the pack comes back to the uploader, not gone.
    variant: 'secondary',
    className: 'bg-amber-400/10 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20',
  },
  decline: {
    placeholder: "Why is this pack declined? The uploader will see this, and can't resubmit.",
    missing: 'Say why the pack is declined.',
    confirm: 'Decline pack',
    busy: 'Declining…',
    variant: 'danger',
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

  return (
    <div className="flex flex-col gap-3">
      {mode && (
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder={MODES[mode].placeholder}
          aria-label={mode === 'reject' ? 'Note for the uploader' : 'Reason for declining'}
          className="resize-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mode ? (
          <>
            <Button onClick={() => run(mode)} disabled={pending} variant={MODES[mode].variant} className={MODES[mode].className}>
              {pending ? MODES[mode].busy : MODES[mode].confirm}
            </Button>
            <Button variant="ghost" onClick={() => { setMode(null); setError(null); }} disabled={pending}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => run('approve')} disabled={pending}>
              {pending ? 'Publishing…' : 'Approve & publish'}
            </Button>
            <Button variant="secondary" onClick={() => setMode('reject')} disabled={pending}>
              Request changes
            </Button>
            {/* Updates to published packs can't be declined: request changes, or take the pack down. */}
            {!isUpdate && (
              <Button variant="danger" onClick={() => setMode('decline')} disabled={pending}>
                Decline
              </Button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
