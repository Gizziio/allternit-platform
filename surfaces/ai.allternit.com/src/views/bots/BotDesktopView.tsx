"use client";

import { BotComputerViewport, type BotComputerViewportProps } from "./BotComputerViewport";

/** Bot Home desktop tab — full lifecycle chrome around the shared cloud-desktop viewport. */
export function BotDesktopView(props: Omit<BotComputerViewportProps, "layout" | "onOpenInAci" | "onReturnToChat">) {
  return <BotComputerViewport {...props} layout="page" />;
}
