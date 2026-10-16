"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDeclinedPack } from '@/app/profile/actions';

/** Two-step delete for a declined pack: no browser dialog, a confirm in place. */
export default function DeletePackButton({ packId }: { packId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => startTransition(async () => {
    const result = await deleteDeclinedPack(packId);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.refresh();
  });

  const pill = 'whitespace-nowrap text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50';
  if (error) return <span className="text-xs text-red-400">{error}</span>;
  return confirming ? (
    <div className="flex items-center gap-1.5">
      <button onClick={remove} disabled={pending} className={`${pill} bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30`}>
        {pending ? 'Deleting…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirming(false)} disabled={pending} className={`${pill} bg-white/10 text-white/70 border-white/20 hover:bg-white/20`}>
        Cancel
      </button>
    </div>
  ) : (
    <button onClick={() => setConfirming(true)} className={`${pill} bg-white/10 text-white/70 border-white/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30`}>
      Delete
    </button>
  );
}
