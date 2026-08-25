import React from "react";
import { ChatComposer } from "@/views/chat/ChatComposer";
import { THEME } from "./ChatView.constants";
import type { GizziEmotion, GizziAttention } from "@/components/ai-elements/GizziMascot";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import type { CanonicalAgentModeId } from "@/lib/agents/agent-mode-contracts";
import type { PluginMentionTarget } from "@/lib/mentions/use-mention-targets";

interface ChatBottomBarProps {
  mode: 'chat' | 'cowork' | 'code';
  isChatEmpty: boolean;
  hideEmptyState: boolean;
  handleSend: (text: string) => void;
  onOpenAgentSession?: (text: string, surface: AgentModeSurface, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  agentSurface: AgentModeSurface;
  setMentionAgentId: (id: string | null) => void;
  mentionAgentId: string | null;
  setPluginMention: (target: PluginMentionTarget | null) => void;
  activeIsLoading: boolean;
  handleStop: () => void;
  selectedModel: string;
  modelSelection: any;
  startSelection: () => void;
  selectModel: (model: any) => void;
  composerTopInfoBar: React.ReactNode;
  composerQuestionBar: React.ReactNode;
  composerBottomInfoBar: React.ReactNode;
  useMonolithLogo: boolean;
  pulseMascot: (emotion: GizziEmotion) => void;
  setLaunchMascotAttention: (attention: GizziAttention | null) => void;
}

export const ChatBottomBar: React.FC<ChatBottomBarProps> = ({
  mode,
  isChatEmpty,
  hideEmptyState,
  handleSend,
  onOpenAgentSession,
  agentSurface,
  setMentionAgentId,
  mentionAgentId,
  setPluginMention,
  activeIsLoading,
  handleStop,
  selectedModel,
  modelSelection,
  startSelection,
  selectModel,
  composerTopInfoBar,
  composerQuestionBar,
  composerBottomInfoBar,
  useMonolithLogo,
  pulseMascot,
  setLaunchMascotAttention,
}) => {
  if (!(mode === 'cowork' || !isChatEmpty || hideEmptyState)) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 w-full flex flex-col items-center pointer-events-none pb-[calc(0.75rem_+_env(safe-area-inset-bottom,0px))] z-40"
      style={{
        background: hideEmptyState || mode === 'cowork' || mode === 'chat' ? 'transparent' : THEME.bgGradient,
      }}
    >
      <div className="w-full max-w-[760px] pointer-events-auto px-2 md:px-5 box-border">
        <ChatComposer
          onSend={handleSend}
          onAgentSend={onOpenAgentSession ? (text, execution) => onOpenAgentSession(text, agentSurface, execution) : undefined}
          onMentionAgentChange={setMentionAgentId}
          mentionAgentId={mentionAgentId}
          onPluginMentionChange={setPluginMention}
          isLoading={activeIsLoading}
          onStop={handleStop}
          selectedModel={selectedModel}
          selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
          onOpenModelPicker={startSelection}
          onSelectModel={selectModel}
          placeholder="Reply…"
          showTopActions={false}
          showModeToggle={false}
          agentModeSurface={agentSurface}
          topInfoBarContent={composerTopInfoBar}
          questionBarContent={composerQuestionBar}
          bottomInfoBarContent={composerBottomInfoBar}
          onInteractionSignal={useMonolithLogo ? undefined : pulseMascot}
          onAttentionChange={useMonolithLogo ? undefined : setLaunchMascotAttention}
        />
      </div>
      {/* Disclaimer — hidden in chrome-free floating HUD where vertical space is at a premium */}
      {!hideEmptyState && (
        <div className="mt-2 text-[12px] text-[var(--ui-text-muted)] text-center pointer-events-auto">
          Allternit is AI and can make mistakes. Please double-check responses.
        </div>
      )}
    </div>
  );
};
