"use client";

import React, { useState } from 'react';
import { Envelope, Copy, PaperPlaneTilt, ArrowSquareOut } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface EmailDraftProps {
  to: string;
  from?: string;
  subject: string;
  body: string;
  cc?: string;
  className?: string;
  onSend?: () => void;
  onCopy?: () => void;
}

export function EmailDraft({ to, from, subject, body, cc, className, onCopy }: EmailDraftProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const handleOpenGmail = () => {
    const params = new URLSearchParams({ to, subject, body, ...(cc ? { cc } : {}) });
    window.open(`https://mail.google.com/mail/?view=cm&${params.toString()}`, '_blank');
  };

  const handleMailto = () => {
    const params = new URLSearchParams({ subject, body });
    window.location.href = `mailto:${to}?${params.toString()}`;
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex size-7  items-center justify-center rounded-md bg-primary/10">
          <Envelope className="size-4  text-primary" />
        </div>
        <span className="text-sm font-medium">Email Draft</span>
      </div>

      {/* Fields */}
      <div className="border-b border-border/50 divide-y divide-border/50">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground w-12 shrink-0">To</span>
          <span className="text-sm text-foreground">{to}</span>
        </div>
        {cc && (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground w-12 shrink-0">Cc</span>
            <span className="text-sm text-foreground">{cc}</span>
          </div>
        )}
        {from && (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground w-12 shrink-0">From</span>
            <span className="text-sm text-foreground">{from}</span>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground w-12 shrink-0">Re</span>
          <span className="text-sm font-medium text-foreground">{subject}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{body}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap border-t border-border px-4 py-3 bg-muted/20">
        <button
          type="button"
          onClick={handleOpenGmail}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
        >
          <ArrowSquareOut className="size-3 " />
          Open in Gmail
        </button>
        <button
          type="button"
          onClick={handleMailto}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <PaperPlaneTilt className="size-3 " />
          Mail App
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors ml-auto"
        >
          <Copy className="size-3 " />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
