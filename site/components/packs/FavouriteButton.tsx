"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Favourites are private (RLS: only your own rows); the count is public. */
export default function FavouriteButton({ packId, initialFavourited, initialCount, signedIn }: {
  packId: string;
  initialFavourited: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [favourited, setFavourited] = useState(initialFavourited);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { error } = favourited
      ? await supabase.from('favourites').delete().eq('pack_id', packId).eq('profile_id', user.id)
      : await supabase.from('favourites').insert({ pack_id: packId, profile_id: user.id });
    if (!error) {
      setFavourited(!favourited);
      setCount((c) => c + (favourited ? -1 : 1));
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={favourited}
      className={`flex items-center gap-1 transition-colors ${favourited ? 'text-pink-400' : 'text-white/60 hover:text-white'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill={favourited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
      </svg>
      <span>{count}</span>
    </button>
  );
}
