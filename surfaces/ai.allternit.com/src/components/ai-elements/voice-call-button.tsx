"use client";

/**
 * VoiceCallButton — compact trigger for the full-screen voice call mode.
 *
 * Renders next to the composer or model picker. Opens VoiceCallMode when
 * clicked and forwards finalized transcripts to the supplied callback.
 */

import React, { useState } from "react";
import { Phone } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { VoiceCallMode } from "./voice-call-mode";
import type { Agent } from "@/lib/agents/agent.types";

interface VoiceCallButtonProps {
  agent?: Agent;
  accentColor?: string;
  onTranscript?: (text: string) => void;
  className?: string;
}

export function VoiceCallButton({
  agent,
  accentColor,
  onTranscript,
  className,
}: VoiceCallButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={className}
        style={{ borderColor: accentColor, color: accentColor }}
        aria-label="Start voice call"
        title="Start voice call"
      >
        <Phone size={18} weight="fill" />
      </Button>
      <VoiceCallMode
        open={open}
        onClose={() => setOpen(false)}
        agentName={agent?.name ?? agent?.botProfile?.displayName ?? "Assistant"}
        accentColor={accentColor}
        onTranscript={(text) => {
          onTranscript?.(text);
          setOpen(false);
        }}
      />
    </>
  );
}

export default VoiceCallButton;
