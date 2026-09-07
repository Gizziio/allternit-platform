"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BotPickerSheet } from "@/views/bots/BotPickerSheet";

/**
 * Shell-level host for the bot-picker bottom drawer. The composer "+" button
 * in the 'bot' surface (and the launchpad's send-with-no-bot fallback in
 * BotLaunchpadView) dispatch 'allternit:open-bot-picker' on window; this host
 * owns the open/close state and renders the sheet above every view, so the
 * drawer opens no matter which surface the composer is embedded in.
 */
export function BotPickerHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpenRequest = () => setOpen(true);
    window.addEventListener("allternit:open-bot-picker", handleOpenRequest);
    return () => window.removeEventListener("allternit:open-bot-picker", handleOpenRequest);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return <BotPickerSheet open={open} onClose={handleClose} />;
}
