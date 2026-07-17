"use client";

import React, { useCallback, useRef, useState } from 'react';
import { Sparkle, Check, X, ArrowsClockwise } from '@phosphor-icons/react';
import { CompactChatComposer } from '@/components/canvas/CompactChatComposer';
import { chatApi } from '@/lib/agents/native-agent-api';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('WorkspaceChatEditor');

interface WorkspaceChatEditorProps {
  agentId: string;
  agentName: string;
  /** Workspace-relative path of the file currently open in the editor. */
  filePath: string;
  /** Current editor content (what the chat should revise). */
  content: string;
  /** Called with the revised file content the user approved. */
  onApply: (next: string) => void;
  /**
   * What is being edited, used for the system-prompt framing. Defaults to
   * `one workspace file of the agent "<agentName>"` — capability editors pass
   * something like `a file of the "PDF Tools" skill`.
   */
  subject?: string;
}

/** Strip a single wrapping markdown code fence, if the model added one. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return match ? match[1] : trimmed;
}

/**
 * Fast, single-shot "chat to edit this file" panel. The current file content
 * is sent with the user's instruction; the streamed reply is shown as a
 * preview and only reaches the editor via Apply — nothing is written to disk
 * here (the WorkspaceTab Save button persists after review).
 */
export function WorkspaceChatEditor({
  agentId,
  agentName,
  filePath,
  content,
  onApply,
  subject,
}: WorkspaceChatEditorProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(
    async (instruction: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      bufferRef.current = '';
      setPreview(null);
      setError(null);
      setIsStreaming(true);

      const systemPrompt = [
        `You are editing ${subject ?? `one workspace file of the agent "${agentName}"`} on the Allternit platform.`,
        `File: ${filePath}`,
        'Revise the file according to the user instruction and return ONLY the complete new file content.',
        'Do not add explanations, do not wrap in markdown code fences, preserve the existing format unless the instruction says otherwise.',
        '',
        '--- CURRENT FILE CONTENT ---',
        content,
        '--- END CURRENT FILE CONTENT ---',
      ].join('\n');

      const chatId = `workspace-edit-${agentId}-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;

      try {
        await chatApi.streamChat(
          chatId,
          instruction,
          undefined,
          {
            onChunk: (chunk) => {
              if (chunk.chunk_type === 'text' && typeof chunk.chunk === 'string') {
                bufferRef.current += chunk.chunk;
              }
            },
            onError: (err) => {
              setError(err.message || 'Chat stream failed');
            },
            onDone: () => {
              const next = stripCodeFence(bufferRef.current);
              if (next) {
                setPreview(next);
              } else {
                setError('The model returned an empty response');
              }
            },
          },
          controller.signal,
          { agentId, agentName, systemPrompt },
        );
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          logger.error({ err: e }, 'workspace chat edit failed');
          setError(e instanceof Error ? e.message : 'Chat stream failed');
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [agentId, agentName, filePath, content, subject],
  );

  return (
    <div className="border-t border-solid border-studio-border-subtle bg-studio-card flex flex-col shrink-0">
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
        <Sparkle size={14} className="text-[var(--accent-primary)]" />
        <span className="text-[12px] font-medium text-studio-text-secondary">
          Edit with chat
        </span>
        {isStreaming && (
          <ArrowsClockwise size={12} className="animate-spin text-studio-text-muted" />
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 p-2.5 bg-red-500/10 rounded-lg">
          <span className="text-[12px] text-red-500">{error}</span>
        </div>
      )}

      {preview !== null && (
        <div className="mx-4 mb-2 rounded-lg border border-solid border-[var(--accent-primary)]/30 bg-studio-bg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-solid border-studio-border-subtle">
            <span className="text-[12px] text-studio-text-secondary">
              Proposed content — review, then Apply to load it into the editor
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onApply(preview);
                  setPreview(null);
                }}
                className="px-2.5 py-1 rounded-md bg-[var(--accent-primary)]/10 border border-solid border-[var(--accent-primary)]/30 text-[var(--accent-primary)] cursor-pointer text-[12px] flex items-center gap-1 font-medium transition-all hover:bg-[var(--accent-primary)]/20"
              >
                <Check size={12} />
                Apply
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-2.5 py-1 rounded-md bg-studio-bg border border-solid border-studio-border-subtle text-studio-text-secondary cursor-pointer text-[12px] flex items-center gap-1 transition-all hover:bg-studio-card"
              >
                <X size={12} />
                Discard
              </button>
            </div>
          </div>
          <pre className="max-h-48 overflow-auto p-3 text-[12px] font-mono text-studio-text-primary whitespace-pre-wrap break-words">
            {preview}
          </pre>
        </div>
      )}

      <CompactChatComposer
        onSend={handleSend}
        isLoading={isStreaming}
        onStop={handleStop}
        placeholder={`Tell ${agentName} how to change this file…`}
      />
    </div>
  );
}

export default WorkspaceChatEditor;
