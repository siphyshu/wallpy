"use client";

import { useState } from 'react';

/**
 * A shell command that copies itself when clicked. `primary` is the white
 * button (the one thing to do on a page); `quiet` sits inside glass cards.
 */
export default function CopyCommand({ command, variant = 'quiet', label }: {
  command: string;
  variant?: 'primary' | 'quiet';
  /** What the copy button is for, for screen readers; defaults to the command. */
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // no clipboard (insecure page, denied): the command is still there to select
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const styles = variant === 'primary'
    ? 'bg-white text-black hover:bg-white/90'
    : 'bg-black/40 border border-white/10 text-white hover:bg-black/60';

  return (
    <button
      onClick={copy}
      className={`group w-full flex items-center justify-between gap-3 px-4 py-2 rounded-lg transition-colors font-mono text-sm text-left ${styles}`}
      aria-label={`Copy ${label ?? 'command'}: ${command}`}
    >
      {/* Wraps rather than truncates: on a phone the whole command should still be readable. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {variant === 'quiet' && <span className="text-white/40 select-none">$ </span>}
        {command}
      </span>
      <span className={`text-xs shrink-0 ${variant === 'primary' ? 'text-black/60' : 'text-white/50'}`}>
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
