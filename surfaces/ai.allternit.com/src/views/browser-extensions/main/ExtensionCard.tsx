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
      extension.isInstalled ? "bg-white/5 border-white/10" : "bg-transparent border-dashed border-zinc-700 opacity-80 hover:opacity-100"
    )}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="size-12 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0 border border-solid border-white/5">
              <span className="text-2xl">{extension.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] truncate">{extension.name}</h3>
                {extension.isInstalled && extension.isEnabled && (
                  <div className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                )}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">v{extension.version} • {extension.author}</p>
            </div>
          </div>
          
          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest bg-zinc-800/50">
            {extension.category}
          </Badge>
        </div>

        <p className="text-[13px] text-zinc-400 leading-relaxed mb-6 line-clamp-2">
          {extension.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3">
          {extension.isInstalled ? (
            <>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => onToggle(extension.id)}
                  className="bg-transparent border-none p-0 cursor-pointer text-zinc-400 hover:text-white transition-colors"
                  title={extension.isEnabled ? "Disable extension" : "Enable extension"}
                >
                  {extension.isEnabled ? (
                    <ToggleRight size={28} weight="fill" className="text-blue-500" />
                  ) : (
                    <ToggleLeft size={28} weight="fill" />
                  )}
                </button>
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  extension.isEnabled ? "text-blue-500" : "text-zinc-500"
                )}>
                  {extension.isEnabled ? "Active" : "Off"}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUninstall(extension.id)}
                className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10 px-2 h-8"
              >
                <Trash size={16} />
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onInstall(extension.id)}
              className="w-full font-bold h-9 bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={16} className="mr-2" weight="bold" /> Install Extension
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
