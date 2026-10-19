"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
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
      <div className={`flex flex-col gap-2 ${card ? 'mt-3 pt-3 border-t border-white/10 w-full' : ''}`} data-confirm={confirm}>
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

  // On a profile card the actions live in a menu (the ⋯ button or a right-click),
  // so a grid of packs isn't a grid of buttons.
  if (card) {
    const items: { label: string; onSelect: () => void; danger?: boolean }[] = [];
    if (published) {
      items.push(listed
        ? { label: 'Unlist', onSelect: () => open('unlist') }
        : { label: 'List in the gallery', onSelect: () => run(() => setPackListed(packId, true)) });
    }
    if (pendingVersionId) items.push({ label: 'Withdraw from review', onSelect: () => open('withdraw') });
    items.push({ label: 'Delete', onSelect: () => open('delete'), danger: true });
    return (
      <CardMenu label={`Actions for ${name}`} items={items} busy={pending}>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </CardMenu>
    );
  }

  const listToggle = published && (listed ? (
    <Button size={size} variant="secondary" onClick={() => open('unlist')}>Unlist</Button>
  ) : (
    <Button size={size} variant="secondary" onClick={() => run(() => setPackListed(packId, true))} disabled={pending}>
      {pending ? 'Listing…' : 'List in the gallery'}
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" data-owner-controls>
        {listToggle}
        {withdraw}
        {remove}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** The ⋯ button in a card's corner and its menu; right-clicking the card opens it too. */
function CardMenu({ label, items, busy, children }: {
  label: string;
  items: { label: string; onSelect: () => void; danger?: boolean }[];
  busy: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = root.current?.closest('[data-pack-card]');
    if (!card) return;
    const onContext = (e: Event) => { e.preventDefault(); setOpen(true); };
    card.addEventListener('contextmenu', onContext);
    return () => card.removeEventListener('contextmenu', onContext);
  }, []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={root}>
      <div className="absolute top-6 right-6 z-10">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((o) => !o)}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md border border-white/10 hover:bg-black/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
        {open && (
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            className="absolute right-0 mt-2 min-w-44 rounded-lg border border-white/10 bg-[#1a1a1a]/95 backdrop-blur-md p-1 shadow-2xl flex flex-col"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect(); }}
                className={`text-left px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:bg-white/10 ${
                  item.danger ? 'text-red-300 hover:bg-red-500/15' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
