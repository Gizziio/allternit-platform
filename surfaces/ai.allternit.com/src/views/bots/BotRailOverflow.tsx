"use client";

/**
 * One ⋯ on the Bots rail. Create bot only — not launchpad "New bot".
 * Hub / Groups are the section labels. New (session) is the header tab.
 */

import React from "react";
import { DotsThree, Plus } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function BotRailOverflow({ onCreateBot }: { onCreateBot: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More"
          title="Create bot"
          className="flex size-7 items-center justify-center rounded-lg text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]"
        >
          <DotsThree size={18} weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-[180px] p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onCreateBot();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-[var(--surface-hover)]"
        >
          <Plus size={14} />
          Create bot
        </button>
      </PopoverContent>
    </Popover>
  );
}
