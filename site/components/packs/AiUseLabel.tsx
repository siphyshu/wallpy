import type { AiUse } from '@/lib/types';

const LABELS: Record<Exclude<AiUse, 'none'>, { text: string; title: string }> = {
  assisted: { text: 'AI-assisted', title: 'The creator used AI tools while making these images.' },
  generated: { text: 'AI-generated', title: 'These images were generated with AI tools.' },
};

/**
 * Disclosure of how AI was used. Shown next to the pack's details, not in the
 * credit line: the credit stays "by <name>".
 */
export default function AiUseLabel({ aiUse, className = '' }: { aiUse: AiUse | null; className?: string }) {
  if (!aiUse || aiUse === 'none') return null;
  const { text, title } = LABELS[aiUse];
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium text-violet-200 ${className}`}
    >
      {text}
    </span>
  );
}
