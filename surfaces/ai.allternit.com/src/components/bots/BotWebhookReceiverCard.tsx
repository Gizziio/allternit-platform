"use client";

/**
 * BotWebhookReceiverCard — exposes the bot's webhook receiver settings.
 *
 * Shows the dedicated inbound webhook receiver port and a quick link to the
 * bot's triggers. The port itself is configured at the deployment/API level
 * and passed in as a prop.
 */

import React, { useState } from "react";
import { Link, PencilSimple, Check, X } from "@phosphor-icons/react";
import { GlassSurface } from "@/design/glass/GlassSurface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BotWebhookReceiverCardProps {
  receiverPort?: number;
  onReceiverPortChange?: (port: number) => void;
  className?: string;
}

export function BotWebhookReceiverCard({
  receiverPort = 8080,
  onReceiverPortChange,
  className,
}: BotWebhookReceiverCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftPort, setDraftPort] = useState(String(receiverPort));

  const handleSave = () => {
    const parsed = parseInt(draftPort, 10);
    if (parsed >= 1024 && parsed <= 65535) {
      onReceiverPortChange?.(parsed);
      setEditing(false);
    }
  };

  return (
    <GlassSurface
      variant="default"
      border="subtle"
      blur="md"
      opacity="medium"
      rounded="xl"
      padding="lg"
      className={cn("space-y-3", className)}
    >
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Link size={18} style={{ color: "var(--accent-primary)" }} />
        <h4 className="text-[14px] font-semibold">Webhook receiver</h4>
      </div>

      <p className="text-[13px] text-[var(--text-secondary)]">
        External services POST to this port to trigger this bot. The port is
        shared across all bots on this runtime.
      </p>

      <div className="flex items-center gap-3">
        {editing ? (
          <>
            <Input
              type="number"
              value={draftPort}
              onChange={(e) => setDraftPort(e.target.value)}
              min={1024}
              max={65535}
              className="w-32 h-8 text-[13px] bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleSave}
              className="size-8"
              aria-label="Save port"
            >
              <Check size={16} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                setDraftPort(String(receiverPort));
                setEditing(false);
              }}
              className="size-8"
              aria-label="Cancel"
            >
              <X size={16} />
            </Button>
          </>
        ) : (
          <>
            <code className="px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]">
              port {receiverPort}
            </code>
            {onReceiverPortChange && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(true)}
                className="size-8"
                aria-label="Edit receiver port"
              >
                <PencilSimple size={16} />
              </Button>
            )}
          </>
        )}
      </div>
    </GlassSurface>
  );
}

export default BotWebhookReceiverCard;
