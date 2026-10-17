"use client";

import { useState, useTransition } from 'react';
import { reportPack } from '@/app/packs/actions';
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from '@/lib/moderation/review';

const BUTTON = 'px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50';

/** "Report this pack": a reason, an optional note, sent to the moderators. Signed-in visitors only. */
export default function ReportPackButton({ packId, alreadyReported }: { packId: string; alreadyReported: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return <p className="text-xs text-white/50">You reported this pack. Moderators will take a look.</p>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="self-start text-xs text-white/50 hover:text-white transition-colors">
        Report this pack
      </button>
    );
  }

  const send = () => {
    if (!reason) {
      setError('Pick a reason.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await reportPack(packId, reason, note);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4" data-testid="report-form">
      <p className="text-sm font-medium">What&apos;s wrong with this pack?</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              reason === r.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={REPORT_NOTE_MAX}
        placeholder="Anything moderators should know (optional). Only moderators see reports."
        className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm resize-none"
      />
      <div className="flex items-center gap-2">
        <button onClick={send} disabled={pending} className={`${BUTTON} bg-white text-black font-medium hover:bg-white/90`}>
          {pending ? 'Sending…' : 'Send report'}
        </button>
        <button onClick={() => { setOpen(false); setError(null); }} disabled={pending} className={`${BUTTON} bg-white/10 text-white/80 hover:bg-white/20`}>
          Cancel
        </button>
        <span className="ml-auto text-xs text-white/40">{note.length}/{REPORT_NOTE_MAX}</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
