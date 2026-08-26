import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoworkTranscript } from "../../cowork/CoworkTranscript";
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
  return (
    <div className={cn('w-full box-border relative', hudMode ? 'max-w-none px-3 py-2' : 'max-w-[760px] px-2 md:px-5 py-6 pb-[180px]')}>
      {embeddedAgentStrip}
      
      <CoworkTranscript
        conversationId={isAgentSessionEmbedded ? (chatId || "") : (chatId ?? "")}
        linkedSessionIds={linkedAgentSessionIds}
        onRegenerate={handleRegenerate}
        onSelectArtifact={onSelectArtifact}
        selectedArtifactTitle={selectedArtifactTitle}
        hideEmptyState={hideEmptyState}
        hudMode={hudMode}
      />

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
            className={cn(
              "fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--accent-chat)] text-white text-[13px] font-semibold flex items-center gap-1.5 border-none shadow-[0_4px_12px_var(--surface-panel)] cursor-pointer",
              hudMode ? "bottom-[80px]" : "bottom-[120px]"
            )}
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
