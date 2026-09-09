"use client";

import React from "react";
import { CheckCircle, Sparkle } from "@phosphor-icons/react";
import { BOT_TEMPLATES, type BotTemplate } from "@/lib/bots/bots.manifest";
import { cn } from "@/lib/utils";
import { WIZARD_COPY } from "../wizard-copy";

export const BLANK_TEMPLATE_ID = "blank";

interface StartStepProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: BotTemplate | null) => void;
}

/**
 * Step 1 — template gallery from the single real catalog (`BOT_TEMPLATES`,
 * the same 7 factory templates the landing page uses). The blank card resets
 * the identity/job fields to defaults. Selecting a template seeds identity,
 * job, tools, AND the template's authored system prompt — the wizard's
 * applyTemplate does the seeding; this component only renders the gallery.
 */
export function StartStep({ selectedTemplateId, onSelectTemplate }: StartStepProps) {
  const copy = WIZARD_COPY.steps.start;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MILESTONE 5 SLOT — "Describe the bot you want" accelerator.         */}
      {/* One platform LLM call (chat-completions client, forced JSON         */}
      {/* matching Partial<CreateAgentInput>) prefills identity/job/tools and */}
      {/* picks the nearest template. Renders here, above the gallery, as a   */}
      {/* collapsible box. Failure falls back to template defaults silently.  */}
      {/* ------------------------------------------------------------------ */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {BOT_TEMPLATES.map((template) => {
          const agent = template.create();
          const profile = agent.botProfile;
          const selected = selectedTemplateId === template.id;
          const Icon = template.icon;
          const accentColor = profile?.accentColor || "var(--accent-primary)";
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template)}
              className={cn(
                "flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-200",
                selected
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{
                    background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                    color: accentColor,
                  }}
                >
                  <Icon size={18} />
                </span>
                {selected && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
              </div>
              <span className="mt-3 text-[14px] font-semibold text-[var(--text-primary)]">
                {profile?.displayName || agent.name}
              </span>
              <span className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                {profile?.tagline || agent.description}
              </span>
            </button>
          );
        })}

        {/* Blank card */}
        <button
          type="button"
          onClick={() => onSelectTemplate(null)}
          className={cn(
            "flex flex-col items-start rounded-xl border border-dashed p-4 text-left transition-all duration-200",
            selectedTemplateId === BLANK_TEMPLATE_ID || selectedTemplateId === null
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
              : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]",
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]">
              <Sparkle size={18} />
            </span>
            {(selectedTemplateId === BLANK_TEMPLATE_ID || selectedTemplateId === null) && (
              <CheckCircle size={16} className="text-[var(--accent-primary)]" />
            )}
          </div>
          <span className="mt-3 text-[14px] font-semibold text-[var(--text-primary)]">
            {copy.blankCardLabel}
          </span>
          <span className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {copy.blankCardDescription}
          </span>
        </button>
      </div>
    </section>
  );
}
