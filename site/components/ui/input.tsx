import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** One field style for input, textarea and select. */
export const fieldClasses = cn(
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40',
  'transition-colors hover:border-white/20 focus:outline-none focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500/50',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(fieldClasses, 'h-10 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClasses, 'min-h-24 py-2 resize-y', className)} {...props} />;
}
