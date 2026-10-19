"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { buttonVariants } from '@/components/ui/button';
import { fieldClasses } from '@/components/ui/input';

/** The bottom of the profile edit form: delete your account, confirmed by typing your username. */
export default function DeleteAccount({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keepPublished, setKeepPublished] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = keepPublished !== null && typed.trim().toLowerCase() === username;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: typed, keepPublished }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not delete your account.');
      await createClient().auth.signOut().catch(() => {});
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account.');
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="px-6 pb-6 -mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-white/50 hover:text-red-300 transition-colors"
        >
          Delete account
        </button>
      </div>
    );
  }

  const option = (value: boolean, title: string, detail: string) => (
    <label className={`flex gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
      keepPublished === value ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <input
        type="radio"
        name="published-packs"
        checked={keepPublished === value}
        onChange={() => setKeepPublished(value)}
        className="mt-1 accent-white"
      />
      <span className="flex flex-col">
        <span className="text-sm text-white">{title}</span>
        <span className="text-xs text-white/50">{detail}</span>
      </span>
    </label>
  );

  return (
    <div className="mx-6 mb-6 flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left" data-testid="delete-account">
      <p className="text-sm font-medium text-red-300">Delete your account</p>
      <p className="text-xs text-white/70">
        Your profile, favourites, drafts and packs in review are deleted. This can&apos;t be undone.
      </p>
      <p className="text-xs text-white/70">Your published packs:</p>
      {option(true, 'Keep them up', 'They stay in the gallery, credited to “deleted user”, and keep working for installs.')}
      {option(false, 'Delete them too', 'Their pages and installs stop working. People keep copies they installed.')}
      <label className="text-xs text-white/70">
        Type <span className="font-mono text-white">{username}</span> to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label="Username"
          placeholder={username}
          className={`${fieldClasses} mt-1 h-10 py-2`}
        />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={!ready || busy}
          className={buttonVariants({ variant: 'danger', className: 'flex-1' })}
        >
          {busy ? 'Deleting…' : 'Delete account'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTyped(''); setKeepPublished(null); setError(null); }}
          disabled={busy}
          className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
