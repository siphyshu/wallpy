"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePack, setPackListed, withdrawVersion, type OwnerActionResult } from '@/app/packs/actions';

type Props = {
  packId: string;
  slug: string;
  name: string;
  /** published and not taken down */
  published: boolean;
  listed: boolean;
  /** the version in review, if any: it can be withdrawn */
  pendingVersionId?: string;
  /** 'page': the owner's pack page; 'card': a pack card on their profile */
  variant: 'page' | 'card';
  /** where to go after deleting (the pack page itself would 404) */
  afterDelete?: string;
};

type Confirm = 'unlist' | 'delete' | 'withdraw' | null;

const PILL = 'whitespace-nowrap text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50';
const PILL_SECONDARY = `${PILL} bg-white/10 text-white/70 border-white/20 hover:bg-white/20`;
const PILL_DANGER = `${PILL} bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30`;
const BUTTON = 'px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50';
const BUTTON_SECONDARY = `${BUTTON} bg-white/10 text-white/80 hover:bg-white/20`;
const BUTTON_DANGER = `${BUTTON} bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30`;

/** Unlist / list, withdraw from review, and delete, each behind a confirm. */
export default function PackOwnerControls({ packId, slug, name, published, listed, pendingVersionId, variant, afterDelete }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const card = variant === 'card';

  const run = (action: () => Promise<OwnerActionResult>, onDone?: () => void) => startTransition(async () => {
    setError(null);
    const result = await action();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirm(null);
    setTyped('');
    if (onDone) onDone();
    else router.refresh();
  });

  const open = (c: Confirm) => { setError(null); setTyped(''); setConfirm(c); };
  const nameMatches = !published || [slug, name.trim().toLowerCase()].includes(typed.trim().toLowerCase());

  const confirmText: Record<Exclude<Confirm, null>, string> = {
    unlist: 'Hide it from the gallery, search and your profile? Its link and installs keep working, and you can list it again any time.',
    withdraw: 'Take this version out of review? It goes back to a draft you can change and send again.',
    delete: published
      ? `This removes the pack from Wallpy for everyone: its page and installs stop working. People who installed it keep their copy. Type ${slug} to confirm.`
      : 'Delete this pack and all its versions?',
  };

  if (confirm) {
    const onConfirm = {
      unlist: () => run(() => setPackListed(packId, false)),
      withdraw: () => run(() => withdrawVersion(packId, pendingVersionId!)),
      delete: () => run(() => deletePack(packId, typed), () => {
        if (afterDelete) router.push(afterDelete);
        router.refresh();
      }),
    }[confirm];
    const danger = confirm === 'delete';
    return (
      <div className={`flex flex-col gap-2 ${card ? 'mt-3 w-full' : ''}`} data-confirm={confirm}>
        <p className={`${card ? 'text-xs' : 'text-sm'} ${danger ? 'text-red-300' : 'text-amber-200'}`}>{confirmText[confirm]}</p>
        {confirm === 'delete' && published && (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={slug}
            aria-label="Pack name"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            disabled={pending || (danger && !nameMatches)}
            className={danger ? (card ? PILL_DANGER : BUTTON_DANGER) : (card ? PILL_SECONDARY : BUTTON_SECONDARY)}
          >
            {pending ? 'Working…' : { unlist: 'Unlist', withdraw: 'Withdraw', delete: 'Delete pack' }[confirm]}
          </button>
          <button onClick={() => setConfirm(null)} disabled={pending} className={card ? PILL_SECONDARY : BUTTON_SECONDARY}>
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const listToggle = published && (listed ? (
    <button onClick={() => open('unlist')} className={card ? PILL_SECONDARY : BUTTON_SECONDARY}>Unlist</button>
  ) : (
    <button onClick={() => run(() => setPackListed(packId, true))} disabled={pending} className={card ? PILL_SECONDARY : BUTTON_SECONDARY}>
      {pending ? 'Listing…' : card ? 'List' : 'List in the gallery'}
    </button>
  ));
  const withdraw = pendingVersionId && (
    <button onClick={() => open('withdraw')} className={card ? PILL_SECONDARY : BUTTON_SECONDARY}>Withdraw</button>
  );
  const remove = (
    <button
      onClick={() => open('delete')}
      className={card
        ? `${PILL} bg-white/10 text-white/70 border-white/20 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30`
        : `${BUTTON} bg-white/10 text-white/80 hover:bg-red-500/20 hover:text-red-300`}
    >
      Delete
    </button>
  );

  return (
    <div className={card ? 'flex flex-col items-end gap-1' : 'flex flex-col gap-2'}>
      <div className="flex flex-wrap items-center gap-2" data-owner-controls>
        {listToggle}
        {withdraw}
        {remove}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
