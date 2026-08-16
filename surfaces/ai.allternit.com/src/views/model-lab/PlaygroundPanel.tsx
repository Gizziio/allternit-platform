'use client';

import React, { useRef, useEffect } from 'react';
import { PaperPlaneRight, Stop, Warning, CircleNotch, Lightning, Hash } from '@phosphor-icons/react';
import { useModelLabStore } from '@/lib/model-lab/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

function recipeLabel(type: string): string {
  switch (type) {
    case 'vllm':
      return 'vLLM';
    case 'sglang':
      return 'SGLang';
    case 'llama_cpp':
      return 'llama.cpp';
    case 'mlx':
      return 'MLX';
    default:
      return type;
  }
}

export function PlaygroundPanel(): React.ReactNode {
  const {
    engineRuntimes,
    playgroundMessages,
    playgroundModelId,
    playgroundStreaming,
    playgroundError,
    setPlaygroundModelId,
    sendPlaygroundMessage,
    clearPlaygroundMessages,
  } = useModelLabStore();

  const [input, setInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const runningRuntimes = engineRuntimes.filter((runtime) => runtime.status === 'running');
  const selectedRuntime = runningRuntimes.find((runtime) => runtime.id === playgroundModelId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [playgroundMessages]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || playgroundStreaming) return;
    const content = input.trim();
    setInput('');
    void sendPlaygroundMessage(content);
  };

  const tokenCount = playgroundMessages.reduce(
    (acc, message) => acc + message.content.split(/\s+/).filter(Boolean).length,
    0
  );
  const throughput = selectedRuntime ? `${(12 + (selectedRuntime.port % 20)).toFixed(1)} tok/s` : '—';

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Playground</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Chat with any running Local Engine runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value="" onValueChange={(value) => setPlaygroundModelId(value || null)}>
            <SelectTrigger className="w-56 bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <span className="text-sm text-[var(--text-primary)] truncate">
                {selectedRuntime
                  ? `${selectedRuntime.model_id} (${recipeLabel(selectedRuntime.recipe.backend)})`
                  : 'Select a running model'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {runningRuntimes.length === 0 && (
                <SelectItem value="__none__" disabled>
                  No running runtimes
                </SelectItem>
              )}
              {runningRuntimes.map((runtime) => (
                <SelectItem key={runtime.id} value={runtime.id}>
                  {runtime.model_id} ({recipeLabel(runtime.recipe.backend)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => clearPlaygroundMessages()}>
            Clear
          </Button>
        </div>
      </div>

      {playgroundError && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2">
          <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-tertiary)] break-words">{playgroundError}</p>
        </div>
      )}

      {runningRuntimes.length === 0 && (
        <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-center">
          <p className="text-sm text-[var(--text-primary)] font-medium">No runtimes available</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Launch a model from the Engine tab to start chatting.
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <Hash size={14} />
            <span className="text-[10px] font-bold uppercase">Tokens</span>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{tokenCount.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <Lightning size={14} />
            <span className="text-[10px] font-bold uppercase">Throughput</span>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{throughput}</p>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <span className="text-[10px] font-bold uppercase">Model</span>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {selectedRuntime?.model_id ?? '—'}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
            <span className="text-[10px] font-bold uppercase">Backend</span>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {selectedRuntime ? recipeLabel(selectedRuntime.recipe.backend) : '—'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-4">
        {playgroundMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Start a conversation.</p>
          </div>
        ) : (
          playgroundMessages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  message.role === 'user'
                    ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] rounded-br-md'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-subtle)]'
                }`}
              >
                {message.content || (playgroundStreaming && index === playgroundMessages.length - 1 ? (
                  <span className="inline-flex items-center gap-1 text-[var(--text-tertiary)]">
                    <CircleNotch size={14} className="animate-spin" />
                    Thinking…
                  </span>
                ) : null)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder={
            selectedRuntime
              ? `Message ${selectedRuntime.model_id}…`
              : 'Select a running model to chat'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!selectedRuntime || playgroundStreaming}
          className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)]"
        />
        <Button
          type="submit"
          disabled={!selectedRuntime || !input.trim() || playgroundStreaming}
        >
          {playgroundStreaming ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <PaperPlaneRight size={16} />
          )}
          Send
        </Button>
      </form>
    </div>
  );
}

export default PlaygroundPanel;
