import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
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
}) => {
  return (
    <div className="w-full max-w-[760px] px-2 md:px-5 py-6 pb-[180px] box-border relative">
      {embeddedAgentStrip}
      
      <CoworkTranscript
        conversationId={isAgentSessionEmbedded ? (chatId || "") : (chatId ?? "")}
        linkedSessionIds={linkedAgentSessionIds}
        onRegenerate={handleRegenerate}
        onSelectArtifact={onSelectArtifact}
        selectedArtifactTitle={selectedArtifactTitle}
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
