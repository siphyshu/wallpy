"use client";

import { useState, useTransition } from 'react';
import { dismissReports, setPackRemoved } from '@/app/moderation/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

type Mode = 'takedown' | 'restore';

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
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          autoFocus
          placeholder={mode === 'takedown'
            ? "Why is this pack taken down? The owner will see this."
            : 'Why is this pack restored? Kept in the moderation log.'}
          aria-label={mode === 'takedown' ? 'Reason for the takedown' : 'Reason for restoring'}
          className="resize-none"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mode ? (
          <>
            <Button onClick={confirm} disabled={pending} variant={mode === 'takedown' ? 'danger' : 'secondary'}>
              {pending ? 'Saving…' : mode === 'takedown' ? 'Take down pack' : 'Restore pack'}
            </Button>
            <Button variant="ghost" onClick={() => { setMode(null); setError(null); }} disabled={pending}>Cancel</Button>
          </>
        ) : (
          <>
            {removed ? (
              <Button variant="secondary" onClick={() => setMode('restore')} disabled={pending}>Restore</Button>
            ) : (
              <Button variant="danger" onClick={() => setMode('takedown')} disabled={pending}>Take down</Button>
            )}
            {openReports > 0 && (
              <Button variant="secondary" onClick={dismiss} disabled={pending}>
                {pending ? 'Dismissing…' : `Dismiss ${openReports === 1 ? 'report' : `${openReports} reports`}`}
              </Button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
