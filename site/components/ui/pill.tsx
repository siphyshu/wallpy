import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Small rounded labels: a pack's kind, a state, a count. Colour only when it
// carries meaning (state); kinds, categories and counts stay neutral.
const tones = {
  neutral: 'bg-white/10 text-white/80 border-white/10',
  outline: 'bg-transparent text-white/70 border-white/20',
  amber: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  green: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30',
};

export type PillTone = keyof typeof tones;

export function pillClasses({ tone = 'neutral', size = 'sm', className }: { tone?: PillTone; size?: 'xs' | 'sm'; className?: string } = {}) {
  return cn(
    'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
    size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
    tones[tone],
    className,
  );
}

export function Pill({ tone, size, className, ...props }: ComponentProps<'span'> & { tone?: PillTone; size?: 'xs' | 'sm' }) {
  return <span className={pillClasses({ tone, size, className })} {...props} />;
}
