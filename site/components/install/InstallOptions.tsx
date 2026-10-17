"use client";

import { useState, useSyncExternalStore } from 'react';
import CopyCommand from '@/components/CopyCommand';
import { INSTALL, detectOs, type Os } from '@/lib/install';

const never = () => () => {};

/** OS tabs (starting on the visitor's own) with that OS's install commands. */
export default function InstallOptions() {
  // The server can't know the OS, so it renders macOS and the browser
  // switches to its own after hydrating; a tab the visitor picks wins.
  const detected = useSyncExternalStore(never, () => detectOs(navigator.userAgent), (): Os => 'macos');
  const [picked, setOs] = useState<Os | null>(null);
  const os = picked ?? detected;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Operating system" className="flex flex-wrap gap-2">
        {(Object.keys(INSTALL) as Os[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={os === key}
            onClick={() => setOs(key)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              os === key ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
          >
            {INSTALL[key].name}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex flex-col gap-3">
        {INSTALL[os].methods.map((m) => (
          <div key={m.label} className="flex flex-col gap-1.5">
            {INSTALL[os].methods.length > 1 && <span className="text-xs text-white/50">{m.label}</span>}
            {m.command && <CopyCommand command={m.command} label={`${m.label} install command`} />}
            {m.link && (
              <a href={m.link.href} className="text-sm text-white/80 underline underline-offset-4 hover:text-white">
                {m.link.text}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
