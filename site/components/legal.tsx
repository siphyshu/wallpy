import type { ReactNode } from 'react';

// Building blocks for the privacy and terms pages: plain sections of text.

export const UPDATED = '20 October 2026';
export const CONTACT = 'siphyshu@gmail.com';

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 flex flex-col gap-3">
      <h2 className="text-2xl font-serif">{title}</h2>
      <div className="flex flex-col gap-3 text-white/75 leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-white/30 hover:[&_a]:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:text-white [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.9em] text-white bg-white/10 rounded px-1.5 py-0.5">{children}</code>;
}
