import React from "react";
import { ChatComposer } from "@/views/chat/ChatComposer";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { GizziMascot, type GizziAttention, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { Suggestions } from "@/components/agent-elements/input/suggestions";
import { THEME, EMPTY_STATE_SUGGESTIONS } from "./ChatView.constants";
import { TypingText, StaggeredReveal } from "./ChatViewAnimations";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

interface ChatEmptyStateProps {
  embeddedAgentStrip: React.ReactNode;
  modelSelection: any;
  isAgentSessionEmbedded: boolean;
  ollamaRunning: boolean;
  modelReady: boolean;
  startSelection: () => void;
  useMonolithLogo: boolean;
  launchMascotEmotion: GizziEmotion;
  launchMascotAttention: GizziAttention | null;
  greeting: { title: string; tagline: string; effectType: "typing" | "reveal" };
  handleSend: (text: string) => void;
  onOpenAgentSession?: (text: string, surface: any) => void;
  agentSurface: AgentModeSurface;
  setMentionAgentId: (id: string | null) => void;
  mentionAgentId: string | null;
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
  launchMascotEmotion,
  launchMascotAttention,
  greeting,
  handleSend,
  onOpenAgentSession,
  agentSurface,
  setMentionAgentId,
  mentionAgentId,
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
    <div className="flex flex-col items-center justify-start w-full max-w-[640px] px-6 py-[10vh] pb-20 box-border flex-1 min-h-0">
      {embeddedAgentStrip}

      {/* No-provider banner — shown when nothing is connected */}
      <div className="fixed top-2 right-2 bg-red-600 text-white text-xs p-2 z-50 rounded">
        modelSelection: {modelSelection ? `${modelSelection.providerId}/${modelSelection.modelId}` : 'null'}
      </div>
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

      {/* Interactive Logo Section */}
      <div className="mb-16 text-center flex flex-col items-center">
        <div
          className="relative group cursor-pointer mb-12 inline-flex items-center justify-center p-5 transition-all duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        >
          <div className="absolute inset-0 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[color-mix(in_srgb,var(--accent-chat)_8%,transparent)]" />
          <div
            className="relative z-10 transition-transform duration-500 group-hover:scale-110"
          >
            {useMonolithLogo ? (
              <MatrixLogo state="idle" size={84} />
            ) : (
              <GizziMascot
                size={76}
                emotion={launchMascotEmotion}
                attention={launchMascotAttention}
              />
            )}
          </div>
        </div>

        <h1 className="text-5xl font-medium text-[var(--ui-text-primary)] mb-6 mt-0 font-[var(--font-research)] tracking-tight min-h-[60px]">
          {greeting.effectType === "typing" ? (
            <TypingText text={greeting.title} speed={0.08} />
          ) : (
            <StaggeredReveal text={greeting.title} />
          )}
        </h1>

        <div className="flex items-center gap-4 justify-center">
          <div className="h-px w-8 bg-[var(--ui-border-muted)]" />
          <div className="text-[14px] text-[var(--ui-text-secondary)] uppercase tracking-[0.2em] font-semibold min-w-[200px]">
            {greeting.effectType === "typing" ? (
              <TypingText text={greeting.tagline} delay={1.5} speed={0.04} />
            ) : (
              <StaggeredReveal text={greeting.tagline} delay={0.8} />
            )}
          </div>
          <div className="h-px w-8 bg-[var(--ui-border-muted)]" />
        </div>
      </div>

      {/* Centered Composer */}
      <div className="w-full mb-16 mx-auto">
        <ChatComposer
          onSend={handleSend}
          onAgentSend={onOpenAgentSession ? (text) => onOpenAgentSession(text, agentSurface) : undefined}
          onMentionAgentChange={setMentionAgentId}
          mentionAgentId={mentionAgentId}
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

      <div className="w-full max-w-[520px] mt-8 mx-auto flex flex-col gap-2.5 items-center">
        <span className="text-[12px] font-medium text-[var(--ui-text-muted)] text-center">
          Try asking
        </span>
        <Suggestions
          items={EMPTY_STATE_SUGGESTIONS}
          onSelect={(item) => handleSend(item.value || item.label)}
          className="justify-center"
          itemClassName="h-8 rounded-full border-[var(--ui-border-muted)] bg-[var(--chat-composer-soft)] px-3 text-[13px] text-[var(--ui-text-secondary)] hover:bg-[var(--chat-composer-hover)] hover:text-[var(--ui-text-primary)]"
        />
      </div>
    </div>
  );
};
