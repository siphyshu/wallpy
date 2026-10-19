import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Segmented tabs that are links (each tab has its own URL). */
export function LinkTabs({ tabs, current, label, className }: {
  tabs: { id: string; label: string; href: string; count?: number }[];
  current: string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn('inline-flex gap-1 p-1 rounded-full bg-white/5 border border-white/10', className)}>
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === current ? 'page' : undefined}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm transition-colors inline-flex items-center gap-1.5',
            t.id === current ? 'bg-white text-black' : 'text-white/70 hover:text-white hover:bg-white/10',
          )}
        >
          {t.label}
          {t.count ? <span className={cn('text-xs', t.id === current ? 'text-black/60' : 'text-white/50')}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
