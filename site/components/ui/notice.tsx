import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// A message about the page or the thing on it: amber for "needs your
// attention", red for errors, neutral for information.
const tones = {
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  red: 'border-red-500/30 bg-red-500/10 text-red-300',
  neutral: 'border-white/10 bg-white/5 text-white/80',
};

export function Notice({ tone = 'amber', action, className, children, ...props }: ComponentProps<'div'> & {
  tone?: keyof typeof tones;
  /** A button or link on the right (below on phones). */
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3', tones[tone], className)}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
