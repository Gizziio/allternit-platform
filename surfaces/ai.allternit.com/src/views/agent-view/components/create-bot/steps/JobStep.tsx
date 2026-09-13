"use client";

import React from "react";
import { CheckCircle, Circle, CircleNotch, Warning } from "@phosphor-icons/react";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { BOT_NATIVE_TOOLS, toggleBotTool } from "@/lib/bots/bot-tool-registry";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WIZARD_COPY } from "../wizard-copy";

interface JobStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  /** "Refine from my description" — same LLM call as the Start-step accelerator. */
  refining: boolean;
  onRefine: () => Promise<void>;
  /** Inline message when the refine call failed (see describeBot.ts). */
  refineError?: string | null;
}

/** Step 3 — job instructions (system prompt) and the tool allowlist. */
export function JobStep({ formData, setFormData, refining, onRefine, refineError }: JobStepProps) {
  const copy = WIZARD_COPY.steps.job;
  const allowedTools = formData.allowedTools ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-[13px] font-medium text-[var(--text-primary)]">
            {copy.systemPromptLabel}
          </Label>
          {/* Refine helper: rewrites the system prompt from the bot's name and
              description. Null result → inline error (see describeBot.ts). */}
          <button
            type="button"
            onClick={() => void onRefine()}
            disabled={refining}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refining ? (
              <>
                <CircleNotch size={14} className="animate-spin" />
                {copy.refineWorking}
              </>
            ) : (
              copy.refineAction
            )}
          </button>
        </div>
        <Textarea
          value={formData.systemPrompt || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder={copy.systemPromptPlaceholder}
          rows={8}
          className="rounded-xl border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] resize-none font-mono text-[13px]"
        />
        {refineError ? (
          <p className="text-[11px] text-[var(--status-error)] mt-1.5 flex items-center gap-1">
            <Warning size={12} weight="fill" />
            {refineError}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{copy.systemPromptHint}</p>
        )}
      </div>

      <div>
        <Label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">
          {copy.toolsLabel}
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BOT_NATIVE_TOOLS.map((tool) => {
            const checked = allowedTools.includes(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    allowedTools: toggleBotTool(prev.allowedTools ?? [], tool.id),
                  }))
                }
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  checked
                    ? "border-[var(--text-primary)] bg-[var(--bg-elevated)]"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]",
                )}
              >
                {checked ? (
                  <CheckCircle size={16} className="mt-0.5 shrink-0 text-[var(--text-primary)]" />
                ) : (
                  <Circle size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                )}
                <span>
                  <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                    {tool.label}
                  </span>
                  <span className="block text-[12px] text-[var(--text-muted)]">
                    {tool.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
