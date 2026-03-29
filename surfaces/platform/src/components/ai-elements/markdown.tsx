"use client";

import { memo } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
  // isStreaming activates the per-block fade-in animation defined in theme.css
  isStreaming?: boolean;
}

export const Markdown = memo(function Markdown({ children, className, isStreaming }: MarkdownProps) {
  return (
    <MessageResponse
      className={cn("a2r-markdown", isStreaming && "is-streaming", className)}
    >
      {children}
    </MessageResponse>
  );
});
