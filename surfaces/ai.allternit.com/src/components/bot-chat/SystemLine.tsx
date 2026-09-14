"use client";

/**
 * System line row (bot streaming UX).
 *
 * Subtle centered non-interactive divider for system-level notices that
 * belong in the transcript timeline (e.g. "Context compacted — earlier
 * messages summarized"). Styled like the gap timestamp: tertiary text, no
 * chrome.
 *
 * @module bot-chat/SystemLine
 */

export interface SystemLineProps {
  text: string;
  className?: string;
}

export function SystemLine({ text, className }: SystemLineProps) {
  return (
    <div className={className} role="separator">
      <span className="block w-full py-2 text-center text-[11px] text-[var(--text-tertiary)]">
        {text}
      </span>
    </div>
  );
}
