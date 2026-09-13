import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

interface CodeTemplateBlockProps {
  language: string;
  code: string;
  className?: string;
}

/**
 * Plain-mono code block with a copy-to-clipboard button. No syntax
 * highlighting dependency — renders a plain <pre>.
 */
export function CodeTemplateBlock({
  language,
  code,
  className,
}: CodeTemplateBlockProps): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard unavailable (insecure context) — fall back to a transient
      // selection prompt-free no-op; the button simply shows feedback.
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={
        "overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] " +
        (className ?? "")
      }
    >
      <div className="flex items-center justify-between border-b border-solid border-[var(--border-subtle)] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
          {language}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} size={12} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-[var(--text-secondary)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
