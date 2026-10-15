"use client";

import { useState } from 'react';

export default function InstallCommand({ slug }) {
  const command = `wallpy download ${slug}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="group flex items-center justify-between gap-3 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors font-mono text-sm"
      aria-label={`Copy install command: ${command}`}
    >
      <span className="truncate">{command}</span>
      <span className="text-xs text-black/60 shrink-0">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
