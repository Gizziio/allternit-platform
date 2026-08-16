import React from "react";
import { ChatComposer } from "@/views/chat/ChatComposer";
import type { GizziAttention, GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { LAUNCH_TOP_PADDING, LAUNCH_SECTION_GAP } from "./launchScreenLayout";
import { LaunchHeader } from "./LaunchHeader";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import type { CanonicalAgentModeId } from "@/lib/agents/agent-mode-contracts";
import type { Agent } from "@/lib/agents/agent.types";
import type { PluginMentionTarget } from "@/lib/mentions/use-mention-targets";

interface ChatEmptyStateProps {
  embeddedAgentStrip: React.ReactNode;
  modelSelection: any;
  isAgentSessionEmbedded: boolean;
  ollamaRunning: boolean;
  modelReady: boolean;
  startSelection: () => void;
  useMonolithLogo: boolean;
  launchLogo?: 'gizzi' | 'matrix' | 'allternit';
  launchMascotEmotion: GizziEmotion;
  launchMascotAttention: GizziAttention | null;
  greeting: { title: string; tagline: string; effectType: "typing" | "reveal" };
  handleSend: (text: string) => void;
  onOpenAgentSession?: (text: string, surface: AgentModeSurface, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  onStartBotSession?: (agent: Agent) => void;
  agentSurface: AgentModeSurface;
  setMentionAgentId: (id: string | null) => void;
  mentionAgentId: string | null;
  setPluginMention: (target: PluginMentionTarget | null) => void;
  activeIsLoading: boolean;
  selectedModel: string;
  selectModel: (model: any) => void;
  showTopActions: boolean;
  pulseMascot: (emotion: GizziEmotion) => void;
  setLaunchMascotAttention: (attention: GizziAttention | null) => void;
  composerTopInfoBar: React.ReactNode;
  composerQuestionBar: React.ReactNode;
  composerBottomInfoBar: React.ReactNode;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
  embeddedAgentStrip,
  modelSelection,
  isAgentSessionEmbedded,
  ollamaRunning,
  modelReady,
  startSelection,
  useMonolithLogo,
  launchLogo,
  launchMascotEmotion,
  launchMascotAttention,
  greeting,
  handleSend,
  onOpenAgentSession,
  onStartBotSession,
  agentSurface,
  setMentionAgentId,
  mentionAgentId,
  setPluginMention,
  activeIsLoading,
  selectedModel,
  selectModel,
  showTopActions,
  pulseMascot,
  setLaunchMascotAttention,
  composerTopInfoBar,
  composerQuestionBar,
  composerBottomInfoBar,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-start w-full max-w-[640px] px-6 pb-20 box-border flex-1 min-h-0"
      style={{ paddingTop: LAUNCH_TOP_PADDING }}
    >
      {embeddedAgentStrip}

      {/* No-provider banner — shown when nothing is connected */}
      {!modelSelection && !isAgentSessionEmbedded && (
        <div className="w-full mb-6 p-[14px_18px] rounded-2xl flex items-center gap-3.5 border border-solid border-[color-mix(in_srgb,var(--accent-chat)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent-chat)_6%,var(--surface-panel,var(--bg-secondary)))]">
          <div className="size-9 rounded-[10px] shrink-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--accent-chat)_12%,transparent)] text-[var(--accent-chat)]">
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
              <path d="M248,124a56.11,56.11,0,0,0-32-50.61V72a48,48,0,0,0-88-26.49A48,48,0,0,0,40,72v1.39A56,56,0,0,0,72,180.27V184a24,24,0,0,0,24,24h64a24,24,0,0,0,24-24v-3.73A56.09,56.09,0,0,0,248,124ZM96,200a8,8,0,0,1-8-8v-4h32v12Zm72,0H152V188h32v4A8,8,0,0,1,168,200Zm8-28H80a40,40,0,0,1-8-79.22V72a32,32,0,0,1,64,0v8h16V72a32,32,0,0,1,64,0v20.78A40,40,0,0,1,176,172Z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--ui-text-primary,var(--text-primary))] mb-0.5">
              No AI connected
            </div>
            <div className="text-[12px] text-[var(--ui-text-muted,var(--text-tertiary))]">
              {ollamaRunning && !modelReady
                ? 'Ollama is running — download Local Brain to chat offline, or connect a cloud provider.'
                : 'Connect a cloud provider, or add a Local Brain to chat offline with no API key.'}
            </div>
          </div>
          <button type="button"
            onClick={startSelection}
            className="shrink-0 px-3.5 py-1.5 rounded-lg bg-[var(--accent-chat)] text-white border-none cursor-pointer text-[12px] font-bold"
          >
            Connect
          </button>
        </div>
      )}

      {/* Greeting header — shared with CoworkLaunchpad (fixed zone) */}
      <LaunchHeader
        greeting={greeting}
        useMonolithLogo={useMonolithLogo}
        logo={launchLogo}
        mascotEmotion={launchMascotEmotion}
        mascotAttention={launchMascotAttention}
      />

      {/* Centered Composer */}
      <div className="w-full mx-auto" style={{ marginBottom: LAUNCH_SECTION_GAP }}>
        <ChatComposer
          onSend={handleSend}
          onAgentSend={onOpenAgentSession ? (text, execution) => onOpenAgentSession(text, agentSurface, execution) : undefined}
          onStartBotSession={onStartBotSession}
          onMentionAgentChange={setMentionAgentId}
          mentionAgentId={mentionAgentId}
          onPluginMentionChange={setPluginMention}
          isLoading={activeIsLoading}
          placeholder="What's brewing today?"
          variant="large"
          selectedModel={selectedModel}
          selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
          onOpenModelPicker={startSelection}
          onSelectModel={selectModel}
          showTopActions={showTopActions}
          onInteractionSignal={useMonolithLogo ? undefined : pulseMascot}
          onAttentionChange={useMonolithLogo ? undefined : setLaunchMascotAttention}
          agentModeSurface={agentSurface}
          topInfoBarContent={composerTopInfoBar}
          questionBarContent={composerQuestionBar}
          bottomInfoBarContent={composerBottomInfoBar}
        />
      </div>

    </div>
  );
};
