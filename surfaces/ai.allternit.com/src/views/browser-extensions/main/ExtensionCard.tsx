"use client";

import React from "react";
import {
  Trash,
  X,
  ToggleLeft,
  ToggleRight,
  Plus
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";
import type { Extension } from "./BrowserExtensions.types";
import { ExtensionLogo } from "./ExtensionLogo";

interface ExtensionCardProps {
  extension: Extension;
  onToggle: (id: string) => void;
  onUninstall: (id: string) => void;
  onInstall: (id: string) => void;
  onOpen: (extension: Extension) => void;
}

/**
 * Extension card — same recipe as the Allternit Office suite cards (rounded-xl,
 * elevated surface, hover border) so the Office & Extensions page reads as one
 * coherent screen in light and dark themes.
 */
export const ExtensionCard: React.FC<ExtensionCardProps> = ({
  extension,
  onToggle,
  onUninstall,
  onInstall,
  onOpen,
}) => {
  return (
    <article
      className="flex h-full min-h-56 flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md"
      data-testid={`extension-card-${extension.id}`}
    >
      <button type="button" onClick={() => onOpen(extension)} className="flex flex-1 flex-col border-none bg-transparent p-0 text-left cursor-pointer">
        <div className="mb-4 flex w-full items-start justify-between gap-3">
          <ExtensionLogo extension={extension} />
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {extension.category}
          </span>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{extension.name}</h3>
          {extension.isInstalled && extension.isEnabled && <span className="size-2 shrink-0 rounded-full bg-green-500" />}
        </div>
        <p className="mt-1 text-[11px] font-medium text-[var(--text-tertiary)]">v{extension.version} · {extension.author}</p>
        <p className="mb-4 mt-2 line-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {extension.description}
        </p>
        <span className="mt-auto text-xs font-medium text-[var(--accent-primary)]">View details</span>
      </button>

      <div className="mt-4 flex min-h-9 items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        {extension.isInstalled ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={(event) => { event.stopPropagation(); onToggle(extension.id); }}
                className="cursor-pointer border-none bg-transparent p-0 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                title={extension.isEnabled ? "Disable extension" : "Enable extension"}
              >
                {extension.isEnabled ? (
                  <ToggleRight size={28} weight="fill" className="text-[var(--accent-browser)]" />
                ) : (
                  <ToggleLeft size={28} weight="fill" />
                )}
              </button>
              <span className={cn(
                  "text-[11px] font-semibold",
                  extension.isEnabled ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
              )}>
                {extension.isEnabled ? "Active" : "Off"}
              </span>
            </div>

            <button type="button"
              onClick={(event) => { event.stopPropagation(); onUninstall(extension.id); }}
              className="inline-flex h-8 items-center rounded-lg border-none bg-transparent px-2 text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
              title={extension.owned ? "Remove extension" : "Uninstall extension"}
            >
              {extension.owned ? <X size={16} /> : <Trash size={16} />}
            </button>
          </>
        ) : (
          <button type="button"
            onClick={(event) => { event.stopPropagation(); onInstall(extension.id); }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border-none bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Plus size={16} weight="bold" /> Install Extension
          </button>
        )}
      </div>
    </article>
  );
};
