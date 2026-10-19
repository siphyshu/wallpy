"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deletePack, setPackListed, withdrawVersion, type OwnerActionResult } from '@/app/packs/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

/** Unlist / list, withdraw from review, and delete, each behind a confirm. */
export default function PackOwnerControls({ packId, slug, name, published, listed, pendingVersionId, variant, afterDelete }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const card = variant === 'card';
  const size = card ? 'sm' : 'md';

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
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={slug}
            aria-label="Pack name"
            autoFocus
          />
        )}
        <div className="flex items-center gap-2">
          <Button size={size} variant={danger ? 'danger' : 'secondary'} onClick={onConfirm} disabled={pending || (danger && !nameMatches)}>
            {pending ? 'Working…' : { unlist: 'Unlist', withdraw: 'Withdraw', delete: 'Delete pack' }[confirm]}
          </Button>
          <Button size={size} variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const listToggle = published && (listed ? (
    <Button size={size} variant="secondary" onClick={() => open('unlist')}>Unlist</Button>
  ) : (
    <Button size={size} variant="secondary" onClick={() => run(() => setPackListed(packId, true))} disabled={pending}>
      {pending ? 'Listing…' : card ? 'List' : 'List in the gallery'}
    </Button>
  ));
  const withdraw = pendingVersionId && (
    <Button size={size} variant="secondary" onClick={() => open('withdraw')}>Withdraw</Button>
  );
  // Calm until hovered; the confirm step is the red one.
  const remove = (
    <Button size={size} variant="secondary" onClick={() => open('delete')} className="hover:bg-red-500/20 hover:text-red-300">
      Delete
    </Button>
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
