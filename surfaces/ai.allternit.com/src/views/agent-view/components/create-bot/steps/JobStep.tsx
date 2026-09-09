"use client";

import React from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { BOT_NATIVE_TOOLS, toggleBotTool } from "@/lib/bots/bot-tool-registry";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WIZARD_COPY } from "../wizard-copy";

interface JobStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
}

/** Step 3 — job instructions (system prompt) and the tool allowlist. */
export function JobStep({ formData, setFormData }: JobStepProps) {
  const copy = WIZARD_COPY.steps.job;
  const allowedTools = formData.allowedTools ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
          {copy.systemPromptLabel}
        </Label>
        {/* MILESTONE 5: the "refine from my description" helper plugs in next to
            this textarea (same LLM call as the Start-step accelerator). */}
        <Textarea
          value={formData.systemPrompt || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          placeholder={copy.systemPromptPlaceholder}
          rows={8}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none font-mono text-[13px]"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{copy.systemPromptHint}</p>
      </div>

      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
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
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]",
                )}
              >
                {checked ? (
                  <CheckCircle size={16} className="mt-0.5 shrink-0 text-[var(--accent-primary)]" />
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
