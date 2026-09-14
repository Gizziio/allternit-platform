"use client";

import { useMemo } from "react";
import { BotComputerWindow } from "@/views/bots/BotComputerWindow";

/** Lightweight computer viewer for the dedicated Electron window.
 *  Must not load ShellApp — a second full shell blanks the rest of Desktop. */
export default function BotComputerPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const botId = params.get("botId") ?? "";
  const sandboxId = params.get("sandboxId");

  if (!botId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0F0C0A] text-sm text-[var(--text-secondary)]">
        Missing bot id
      </div>
    );
  }

  return <BotComputerWindow botId={botId} sandboxId={sandboxId} />;
}
