"use client";

import React, { useState } from "react";
import { Robot, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { BotTeamImportWizard } from "@/views/bots/BotTeamImportWizard";

export function TeamImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} />
        Import team
      </Button>
      {open && <BotTeamImportWizard onClose={() => setOpen(false)} />}
    </>
  );
}
