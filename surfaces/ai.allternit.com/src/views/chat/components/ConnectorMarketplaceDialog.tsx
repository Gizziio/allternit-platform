"use client";

import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { ConnectorMarketplace } from "@/components/marketplace/ConnectorMarketplace";
import { cn } from "@/lib/utils";

/** Connectors promoted to the Featured section when opened from the chat "+" sheet. */
export const CHAT_FEATURED_CONNECTOR_IDS = ["gmail", "google_drive", "allternit-mail"];

export interface ConnectorMarketplaceDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Chat "+" sheet → Connectors: the owned-connector marketplace in a dialog,
 * with Gmail / Google Drive / Allternit Mail featured on top.
 */
export function ConnectorMarketplaceDialog({ open, onClose }: ConnectorMarketplaceDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[180] bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[190] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[min(880px,calc(100vw-32px))] max-h-[min(780px,calc(100vh-48px))]",
            "rounded-2xl border border-[var(--border-subtle)]",
            "bg-[var(--glass-bg-thick)]/90 backdrop-blur-xl backdrop-saturate-150",
            "shadow-[0_24px_80px_var(--shell-overlay-backdrop)]",
            "flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onPointerDownOutside={onClose}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-[var(--text-primary)]">
              Connectors
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              onClick={onClose}
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Close"
            >
              <X size={14} weight="bold" />
            </DialogPrimitive.Close>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 pb-5">
            <ConnectorMarketplace featuredIds={CHAT_FEATURED_CONNECTOR_IDS} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
