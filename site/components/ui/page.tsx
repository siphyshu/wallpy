import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Three page widths, chosen by what the page holds; every page shares the same
// top offset (176px, well clear of the floating navbar) and side gutters.
const widths = {
  reading: 'max-w-3xl', // docs, notices, sign-in forms
  browse: 'max-w-6xl', // gallery, moderation
  wide: 'max-w-7xl', // pack page, profile, upload
};

export function Page({ width = 'browse', className, children }: { width?: keyof typeof widths; className?: string; children: ReactNode }) {
  return <main className={cn('mx-auto w-full px-4 sm:px-6 pt-44 pb-24', widths[width], className)}>{children}</main>;
}

/** The page's title block: a centred serif title, one line under it, actions (e.g. tabs) below. */
export function PageHeader({ title, description, eyebrow, actions, className }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-12 flex flex-col items-center gap-4 text-center', className)}>
      {eyebrow && <div className="text-xs uppercase tracking-wider text-white/50">{eyebrow}</div>}
      <h1 className="font-serif text-5xl md:text-6xl leading-none text-balance">{title}</h1>
      {description && <p className="text-white/70 max-w-2xl text-pretty">{description}</p>}
      {actions && <div className="flex flex-wrap justify-center gap-2 mt-2">{actions}</div>}
    </header>
  );
}

/** A section heading inside a page. */
export function SectionTitle({ children, count, className }: { children: ReactNode; count?: number; className?: string }) {
  return (
    <h2 className={cn('font-serif text-3xl leading-tight flex items-center gap-3', className)}>
      {children}
      {count !== undefined && <span className="font-sans text-sm text-white/60 px-2.5 py-0.5 rounded-full bg-white/10">{count}</span>}
    </h2>
  );
}
