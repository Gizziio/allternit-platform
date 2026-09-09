"use client";

import React, { useState } from "react";
import { CaretDown, CaretRight, CheckCircle, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { BOT_TEMPLATES, type BotTemplate } from "@/lib/bots/bots.manifest";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WIZARD_COPY } from "../wizard-copy";

export const BLANK_TEMPLATE_ID = "blank";

interface StartStepProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: BotTemplate | null) => void;
  /** Describe-to-prefill accelerator (milestone 5). */
  describing: boolean;
  onDescribe: (text: string) => Promise<void>;
}

/**
 * Step 1 — template gallery from the single real catalog (`BOT_TEMPLATES`,
 * the same 7 factory templates the landing page uses). The blank card resets
 * the identity/job fields to defaults. Selecting a template seeds identity,
 * job, tools, AND the template's authored system prompt — the wizard's
 * applyTemplate does the seeding; this component only renders the gallery.
 */
export function StartStep({ selectedTemplateId, onSelectTemplate, describing, onDescribe }: StartStepProps) {
  const copy = WIZARD_COPY.steps.start;
  const [describeOpen, setDescribeOpen] = useState(false);
  const [describeText, setDescribeText] = useState("");

  const canPrefill = describeText.trim().length > 0 && !describing;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      {/* Describe-to-prefill accelerator: one platform LLM call seeds the
          wizard from a sentence. Failure falls back to template defaults
          silently — see describeBot.ts. */}
      <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <button
          type="button"
          onClick={() => setDescribeOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          {describeOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
          {copy.describeToggle}
        </button>
        {describeOpen && (
          <div className="space-y-3 px-4 pb-4">
            <p className="text-[12px] text-[var(--text-muted)]">{copy.describeDescription}</p>
            <Textarea
              value={describeText}
              onChange={(e) => setDescribeText(e.target.value)}
              placeholder={copy.describePlaceholder}
              rows={3}
              className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void onDescribe(describeText)}
                disabled={!canPrefill}
                className="gap-1.5 bg-[var(--accent-primary)] text-[var(--ui-text-inverse,#fff)] border-none hover:opacity-90"
              >
                {describing ? (
                  <>
                    <CircleNotch size={14} className="animate-spin" />
                    {copy.describeWorking}
                  </>
                ) : (
                  copy.describeAction
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

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
