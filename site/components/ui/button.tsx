import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// See docs/design-system.md. One primary (white) action per area; secondary
// for the rest; danger only for destructive actions.
const variants = {
  primary: 'bg-white text-black hover:bg-white/90',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
  ghost: 'text-white/70 hover:text-white hover:bg-white/10',
  danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30',
  link: 'text-white/80 underline underline-offset-4 decoration-white/30 hover:text-white hover:decoration-white',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9',
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** Button classes, for styling other elements (e.g. a <Link>) as a button. */
export function buttonVariants({ variant = 'primary', size = 'md', className }: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    variant !== 'link' && sizes[size],
    variants[variant],
    className,
  );
}

export function Button({ className, variant, size, type = 'button', ...props }: ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
