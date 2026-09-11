"use client";

import React from "react";
import type { BotBrainBinding, BotBrainMode } from "@/lib/agents/agent.types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BOT_BRAIN_MODE_LABEL,
  NATIVE_HARNESS_IDS,
  NATIVE_HARNESS_LABEL,
  normalizeBotBrain,
  type NativeHarnessId,
} from "./bot-brain";

const MODE_HINT: Record<BotBrainMode, string> = {
  allternit_cloud: "Runs on Allternit cloud. Model is the one you pick below.",
  native_harness: "Resumes a local Codex, Claude, or Kimi session. Does not fall back to cloud.",
  uhp_harness: "Binds a UHP harness id. Does not fall back to cloud.",
};

interface BotBrainBindFieldsProps {
  value: BotBrainBinding | undefined;
  onChange: (next: BotBrainBinding) => void;
  nativeSessionPlaceholder?: string;
}

export function BotBrainBindFields({
  value,
  onChange,
  nativeSessionPlaceholder = "Leave empty to bind on first start",
}: BotBrainBindFieldsProps) {
  const brain = normalizeBotBrain(value);

  const setMode = (mode: BotBrainMode) => {
    onChange(
      normalizeBotBrain({
        ...brain,
        mode,
        harness: mode === "native_harness" ? brain.harness || "codex" : undefined,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
          Brain
        </Label>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          How this bot runs. Separate from the Gizzi knowledge brain.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["allternit_cloud", "native_harness", "uhp_harness"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                brain.mode === mode
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                  : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]",
              )}
            >
              <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                {BOT_BRAIN_MODE_LABEL[mode]}
              </span>
              <span className="block text-[12px] text-[var(--text-muted)] mt-1">
                {MODE_HINT[mode]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {brain.mode === "native_harness" && (
        <div className="space-y-3">
          <div>
            <Label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">
              Native harness
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {NATIVE_HARNESS_IDS.map((id: NativeHarnessId) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(normalizeBotBrain({ ...brain, mode: "native_harness", harness: id }))}
                  className={cn(
                    "rounded-xl border p-3 text-[13px] font-medium transition-all",
                    brain.harness === id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]",
                  )}
                >
                  {NATIVE_HARNESS_LABEL[id]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">
              Native session id
            </Label>
            <Input
              value={brain.nativeSessionId ?? ""}
              onChange={(e) =>
                onChange(
                  normalizeBotBrain({
                    ...brain,
                    mode: "native_harness",
                    nativeSessionId: e.target.value,
                  }),
                )
              }
              placeholder={nativeSessionPlaceholder}
              className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      )}

      {brain.mode === "uhp_harness" && (
        <div>
          <Label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">
            UHP harness id
          </Label>
          <Input
            value={brain.uhpHarnessId ?? ""}
            onChange={(e) =>
              onChange(
                normalizeBotBrain({
                  ...brain,
                  mode: "uhp_harness",
                  uhpHarnessId: e.target.value,
                }),
              )
            }
            placeholder="Required to start this bot"
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      )}
    </div>
  );
}
