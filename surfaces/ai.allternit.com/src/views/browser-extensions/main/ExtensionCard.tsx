"use client";

import React from "react";
import { 
  PuzzlePiece, 
  Trash, 
  Check, 
  X,
  ToggleLeft,
  ToggleRight,
  Plus
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Extension } from "./BrowserExtensions.types";

interface ExtensionCardProps {
  extension: Extension;
  onToggle: (id: string) => void;
  onUninstall: (id: string) => void;
  onInstall: (id: string) => void;
}

export const ExtensionCard: React.FC<ExtensionCardProps> = ({
  extension,
  onToggle,
  onUninstall,
  onInstall,
}) => {
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 border-solid",
      extension.isInstalled ? "bg-[var(--shell-floating-bg)] border-[var(--shell-divider)]" : "bg-transparent border-dashed border-[var(--shell-divider)] opacity-80 hover:opacity-100"
    )}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-12 rounded-2xl bg-[color-mix(in_srgb,var(--accent-browser)_12%,var(--shell-view-bg))] text-[var(--accent-browser)] flex items-center justify-center shrink-0 border border-solid border-[var(--accent-browser)]/20">
              <span className="text-xl font-black">{extension.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] truncate">{extension.name}</h3>
                {extension.isInstalled && extension.isEnabled && (
                  <div className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                )}
              </div>
              <p className="text-[11px] text-[var(--shell-item-muted)] font-medium">v{extension.version} • {extension.author}</p>
            </div>
          </div>
          
          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-zinc-800/50">
            {extension.category}
          </Badge>
        </div>

        <p className="text-[13px] text-[var(--shell-item-muted)] leading-relaxed mb-6 line-clamp-2">
          {extension.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3">
          {extension.isInstalled ? (
            <>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => onToggle(extension.id)}
                  className="bg-transparent border-none p-0 cursor-pointer text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] transition-colors"
                  title={extension.isEnabled ? "Disable extension" : "Enable extension"}
                >
                  {extension.isEnabled ? (
                    <ToggleRight size={28} weight="fill" className="text-[var(--accent-browser)]" />
                  ) : (
                    <ToggleLeft size={28} weight="fill" />
                  )}
                </button>
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  extension.isEnabled ? "text-[var(--accent-browser)]" : "text-[var(--shell-item-muted)]"
                )}>
                  {extension.isEnabled ? "Active" : "Off"}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUninstall(extension.id)}
                className="text-[var(--shell-item-muted)] hover:text-red-500 hover:bg-red-500/10 px-2 h-8"
              >
                {extension.owned ? <X size={16} /> : <Trash size={16} />}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onInstall(extension.id)}
              className="w-full font-bold h-9 bg-[var(--accent-browser)] hover:brightness-110"
            >
              <Plus size={16} className="mr-2" weight="bold" /> Install Extension
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
