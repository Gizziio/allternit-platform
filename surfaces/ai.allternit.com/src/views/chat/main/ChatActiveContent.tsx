import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { CoworkTranscript } from "../../cowork/CoworkTranscript";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { THEME } from "./ChatView.constants";

interface ChatActiveContentProps {
  embeddedAgentStrip: React.ReactNode;
  isAgentSessionEmbedded: boolean;
  chatId: string | null;
  linkedAgentSessionIds: string[];
  handleRegenerate: () => void;
  showJumpToBottom: boolean;
  setShouldAutoScroll: (auto: boolean) => void;
  scrollToBottom: (behavior: ScrollBehavior) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSelectArtifact?: (artifact: any) => void;
  selectedArtifactTitle?: string;
  hideEmptyState?: boolean;
  hudMode?: boolean;
}

export const ChatActiveContent: React.FC<ChatActiveContentProps> = ({
  embeddedAgentStrip,
  isAgentSessionEmbedded,
  chatId,
  linkedAgentSessionIds,
  handleRegenerate,
  showJumpToBottom,
  setShouldAutoScroll,
  scrollToBottom,
  messagesEndRef,
  onSelectArtifact,
  selectedArtifactTitle,
  hideEmptyState,
  hudMode = false,
}) => {
  const effectiveConversationId = isAgentSessionEmbedded ? (chatId || "") : (chatId ?? "");
  const { hasAssistantMessages, isStreaming } = useChatSessionStore((state) => {
    const session = effectiveConversationId ? state.sessions.find((s) => s.id === effectiveConversationId) : null;
    return {
      hasAssistantMessages: (session?.messages ?? []).some((m) => m.role === 'assistant'),
      isStreaming: state.streamingBySession[effectiveConversationId]?.isStreaming ?? false,
    };
  });

  return (
    <div className={hudMode
      ? "w-full pt-1 pb-1 box-border relative"
      : "w-full max-w-[760px] px-2 md:px-5 py-6 pb-[180px] box-border relative"
    }>
      {embeddedAgentStrip}

      {hudMode ? (
        <div className="[&_.assistant-message-group]:py-1 [&_.assistant-message-group]:first:pt-0 [&_.assistant-message-group]:last:pb-0 [&_.assistant-message-group]:max-w-none">
          {isStreaming && !hasAssistantMessages && (
            <div className="flex items-center gap-2 py-2 px-3 text-[13px] text-white/70">
              <span className="inline-block size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
              <span>Thinking…</span>
            </div>
          )}
          <CoworkTranscript
            conversationId={effectiveConversationId}
            linkedSessionIds={linkedAgentSessionIds}
            onRegenerate={handleRegenerate}
            onSelectArtifact={onSelectArtifact}
            selectedArtifactTitle={selectedArtifactTitle}
            hideEmptyState={hideEmptyState}
          />
        </div>
      ) : (
        <CoworkTranscript
          conversationId={effectiveConversationId}
          linkedSessionIds={linkedAgentSessionIds}
          onRegenerate={handleRegenerate}
          onSelectArtifact={onSelectArtifact}
          selectedArtifactTitle={selectedArtifactTitle}
          hideEmptyState={hideEmptyState}
        />
      )}
      
      {/* Jump to present button */}
      <AnimatePresence>
        {showJumpToBottom && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              setShouldAutoScroll(true);
              scrollToBottom('smooth');
            }}
            className="fixed bottom-[120px] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--accent-chat)] text-white text-[13px] font-semibold flex items-center gap-1.5 border-none shadow-[0_4px_12px_var(--surface-panel)] cursor-pointer"
          >
            <ArrowDown size={14} />
            Jump to present
          </motion.button>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />
    </div>
  );
};
