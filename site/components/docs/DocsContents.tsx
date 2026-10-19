"use client";

import { useEffect, useState } from 'react';

/**
 * The docs' contents. Phones and tablets: chips under the header. Desktop: a
 * list that stays beside the text and marks the section you're reading.
 */
export default function DocsContents({ sections, variant }: { sections: { id: string; title: string }[]; variant: 'chips' | 'side' }) {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    if (variant !== 'side') return;
    // A section is "current" once its heading passes the upper third of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -65% 0px' },
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [sections, variant]);

  if (variant === 'chips') {
    return (
      <nav aria-label="On this page" className="lg:hidden flex flex-wrap justify-center gap-2 mb-14">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="px-3 py-1 rounded-full bg-white/10 text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors">
            {s.title}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="On this page" className="hidden lg:block sticky top-36 self-start justify-self-end w-44">
      <p className="text-xs uppercase tracking-wider text-white/50 mb-3">On this page</p>
      <ul className="flex flex-col border-l border-white/10">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={current === s.id ? 'location' : undefined}
              className="block -ml-px border-l pl-4 py-1.5 text-sm transition-colors border-transparent text-white/50 hover:text-white aria-[current]:border-white aria-[current]:text-white"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
