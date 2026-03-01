import React from "react";
import { cn } from "../../lib/utils";
import { Paperclip, Microphone, ArrowUp, Globe, Atom, Robot, EyeSlash, TerminalWindow, AppWindow } from "@phosphor-icons/react";
import { PromptInputAction, usePromptInput } from "./prompt-input";
import { PromptModelSelector } from "./prompt-model-selector";

export type PromptInputFooterProps = {
  model: string;
  onModelChange: (id: string) => void;
  onSend?: () => void;
  className?: string;
  extraActions?: React.ReactNode;
};

export function PromptInputFooter({
  model,
  onModelChange,
  onSend,
  className,
  extraActions,
}: PromptInputFooterProps) {
  const { onAttach, toggleRecording, isRecording, value, onSubmit } = usePromptInput();
  const sendHandler = onSend ?? onSubmit;

  return (
    <div className={cn("flex items-center justify-between px-3 pb-3 pt-1 gap-2", className)}>
      <div className="flex items-center gap-1 flex-wrap">
        <PromptInputAction tooltip="Attach files" onClick={() => onAttach('file')}>
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <Paperclip size={18} />
          </button>
        </PromptInputAction>

        <PromptInputAction tooltip={isRecording ? 'Stop recording' : 'Voice input'} onClick={toggleRecording}>
          <button className={isRecording ? 'text-red-500 p-1.5' : 'p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}>
            <Microphone size={18} weight={isRecording ? 'fill' : 'bold'} />
          </button>
        </PromptInputAction>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <PromptModelSelector value={model} onChange={onModelChange} />

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <PromptInputAction tooltip="Web Search">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <Globe size={18} />
          </button>
        </PromptInputAction>

        <PromptInputAction tooltip="Deep Research">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <Atom size={18} />
          </button>
        </PromptInputAction>

        <PromptInputAction tooltip="Agent Mode">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <Robot size={18} />
          </button>
        </PromptInputAction>

        <PromptInputAction tooltip="Temporary Chat">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <EyeSlash size={18} />
          </button>
        </PromptInputAction>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <PromptInputAction tooltip="Terminal Sync">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <TerminalWindow size={18} />
          </button>
        </PromptInputAction>

        <PromptInputAction tooltip="App Context">
          <button className="p-1.5 rounded-md hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)]">
            <AppWindow size={18} />
          </button>
        </PromptInputAction>

        {extraActions}
      </div>

      <button
        onClick={sendHandler}
        disabled={!value.trim()}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent-chat)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm"
      >
        <ArrowUp size={18} weight="bold" />
      </button>
    </div>
  );
}
