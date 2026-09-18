"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BotPickerSheet } from "@/views/bots/BotPickerSheet";

/**
 * Shell-level host for the bot-picker bottom drawer. The bot-mode rail "New"
 * button dispatches 'allternit:open-bot-picker' on window; this host owns the
 * open/close state and renders the sheet above every view.
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
