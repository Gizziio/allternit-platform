"use client";

import React, { useMemo } from "react";
import type { Agent, AvatarConfig, CreateAgentInput } from "@/lib/agents/agent.types";
import { BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import { describeDesktopResources } from "@/lib/bots/vm-operator";
import { BotHubCard } from "@/views/agent-hub/main/BotHubCard";
import { WIZARD_COPY } from "./wizard-copy";

interface WizardPreviewProps {
  formData: Partial<CreateAgentInput>;
  avatar: AvatarConfig;
}

/**
 * Right rail — the actual BotHubCard fed a synthetic in-progress Agent, over a
 * compact summary of the job/tools/computer choices. Replaces the dead
 * checklist panel and the old text-table review step: by the last step you are
 * looking at your bot, not reviewing a form.
 */
export function WizardPreview({ formData, avatar }: WizardPreviewProps) {
  const copy = WIZARD_COPY.preview;
  const botProfile = formData.botProfile;

  const previewBot = useMemo<Agent>(() => {
    const handle = formData.name || "bot";
    const profile = {
      displayName: botProfile?.displayName || copy.untitledBot,
      tagline: botProfile?.tagline || "",
      welcomeMessage: botProfile?.welcomeMessage || "",
      starterPrompts: botProfile?.starterPrompts || [],
      accentColor: botProfile?.accentColor || "#D4956A",
      groupChatEnabled: botProfile?.groupChatEnabled ?? true,
      botCategory: botProfile?.botCategory || "custom",
    };
    return {
      id: `preview-${handle}`,
      name: handle,
      description: formData.description || "",
      isBot: true,
      botProfile: profile,
      // Legacy avatar config path — BotAvatar reads bot.avatar when the bot
      // has no stored BotAvatar union, so gizzi color/mood/pet/image choices
      // render exactly as they will after create.
      avatar,
      vmOperator: formData.vmOperator,
      status: "idle",
      category: formData.category ?? "general",
    } as Agent;
  }, [avatar, botProfile, copy.untitledBot, formData.category, formData.description, formData.name, formData.vmOperator]);

  const toolCount = formData.allowedTools?.length ?? 0;
  const computerOn = formData.vmOperator?.enabled === true;
  const category = botProfile?.botCategory;

  return (
    <div className="space-y-4">
      <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {copy.title}
      </div>

      <BotHubCard bot={previewBot} onClick={() => {}} />

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2.5">
        <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {copy.summaryTitle}
        </div>
        <SummaryRow label={copy.summaryHandle} value={`@${formData.name || "bot"}`} />
        <SummaryRow
          label={copy.summaryCategory}
          value={category ? BOT_CATEGORIES[category]?.label ?? category : "—"}
        />
        <SummaryRow label={copy.summaryToolsLabel} value={copy.summaryTools(toolCount)} />
        <SummaryRow
          label={copy.summaryComputer}
          value={
            computerOn
              ? `${copy.summaryComputerOn} · ${describeDesktopResources(formData.vmOperator?.resources)}`
              : copy.summaryComputerOff
          }
        />
        <SummaryRow
          label={copy.summaryModel}
          value={`${(formData.provider || "—").toUpperCase()} · ${formData.model || "—"}`}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-[12px] font-medium text-[var(--text-primary)] break-words max-w-[65%]">
        {value}
      </span>
    </div>
  );
}
