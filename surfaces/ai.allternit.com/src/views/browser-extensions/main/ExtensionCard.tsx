"use client";

import React from "react";
import { 
  Trash, 
  X,
  ToggleLeft,
  ToggleRight,
  Plus
} from '@phosphor-icons/react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export const ExtensionCard: React.FC<ExtensionCardProps> = ({
  extension,
  onToggle,
  onUninstall,
  onInstall,
  onOpen,
}) => {
  return (
    <Card className={cn(
      "h-full min-h-[230px] overflow-visible rounded-xl border-solid bg-[var(--bg-elevated)] transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md",
      extension.isInstalled ? "border-[var(--border-subtle)]" : "border-dashed border-[var(--border-default)]"
    )}>
      <CardContent className="flex h-full flex-col p-5 pt-5">
        <button type="button" onClick={() => onOpen(extension)} className="flex flex-1 flex-col text-left">
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
        <p className="mb-5 mt-3 line-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {extension.description}
        </p>
        <span className="mb-4 mt-auto text-xs font-medium text-[var(--accent-primary)]">View details</span>
        </button>

        <div className="flex min-h-9 items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
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
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => { event.stopPropagation(); onUninstall(extension.id); }}
                className="h-8 px-2 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500"
              >
                {extension.owned ? <X size={16} /> : <Trash size={16} />}
              </Button>
            </>
          ) : (
            <Button
              onClick={(event) => { event.stopPropagation(); onInstall(extension.id); }}
              className="h-9 w-full bg-[var(--text-primary)] font-medium text-[var(--bg-elevated)] hover:opacity-90"
            >
              <Plus size={16} className="mr-2" weight="bold" /> Install Extension
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
