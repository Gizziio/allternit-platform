"use client";

import React, { useRef, useEffect } from "react";
import { useRunnerStore } from "./runner.store";
import { RunnerTraceSidebar } from "./RunnerTraceSidebar";
import { Send, Paperclip, Mic } from "lucide-react";

// Import the NewChatInput component from ChatView
import { NewChatInput } from "@/views/ChatView";

export function AgentRunnerPanel({ onCollapse }: { onCollapse: () => void }) {
  const { activeRun, draft, setDraft, submit } = useRunnerStore();
  const elapsed = activeRun ? ((Date.now() - activeRun.startedAt) / 1000).toFixed(2) : "0.00";

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    setDraft(text);
    submit();
  };

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        <div className="flex gap-4 h-full">
          {/* Main content */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {activeRun ? (
              <>
                <div className="p-4 rounded-xl border" style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-default)'
                }}>
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Task</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{activeRun.prompt}</div>
                </div>

                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Status: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{activeRun.state}</span> · Thinking Process {elapsed}s
                </div>

                <pre className="flex-1 whitespace-pre-wrap font-mono text-sm p-4 rounded-xl border overflow-auto min-h-[200px]"
                     style={{
                       backgroundColor: 'var(--bg-secondary)',
                       borderColor: 'var(--border-default)',
                       color: 'var(--text-primary)'
                     }}>
                  {activeRun.output || "(streaming output…)"}
                </pre>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                No active run.
              </div>
            )}
          </div>

          {/* Trace sidebar */}
          <div className="w-64 shrink-0 h-full">
            <RunnerTraceSidebar />
          </div>
        </div>
      </div>

      {/* Footer input with platform styling - Using same structure as ChatView */}
      <div className="bg-background p-4 w-full">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-3">
          <NewChatInput
            onSend={handleSend}
            isLoading={false}
            onStop={() => {}}
            selectedModel="gpt-4o"
            onOpenModelPicker={() => {}}
            conversationMode="llm"
            onConversationModeChange={() => {}}
            availableAgents={[]}
            selectedAgentId={null}
            onSelectAgent={() => {}}
            showAgentControlPanel={false}
            onToggleAgentControlPanel={() => {}}
            useWebSearch={false}
            onToggleWebSearch={() => {}}
            models={[
              { id: "gpt-4o", name: "GPT-4o" },
              { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
              { id: "gemini-1-5-pro", name: "Gemini 1.5 Pro" },
            ]}
            transcript={null}
            interimTranscript={null}
            clearTranscript={() => {}}
            hoveredTemplate={null}
            selectedTemplate={null}
            onTemplateSent={() => {}}
          />
        </div>
      </div>
    </div>
  );
}