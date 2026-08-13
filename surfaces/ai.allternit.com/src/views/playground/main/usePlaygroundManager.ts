"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import type { 
  TemplateId, 
  Message, 
  Artifact, 
  LeftTab, 
  RightTab,
  TemplateDefinition
} from './PlaygroundView.types';
import { TEMPLATES } from './PlaygroundView.constants';
import { getDefaultAgentModel } from '@/lib/agents/agent-models';

const uid = () => Math.random().toString(36).slice(2, 9);

const ALLTERNIT_AI_URL = process.env.NEXT_PUBLIC_ALLTERNIT_AI_URL || '';

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function extractArtifact(content: string): { text: string; artifact: Artifact | null } {
  const fences = [
    { type: 'html' as const, regex: /```html\n([\s\S]*?)\n```/ },
    { type: 'jsx' as const, regex: /```jsx\n([\s\S]*?)\n```/ },
    { type: 'svg' as const, regex: /```svg\n([\s\S]*?)\n```/ },
    { type: 'mermaid' as const, regex: /```mermaid\n([\s\S]*?)\n```/ },
    { type: 'markdown' as const, regex: /```markdown\n([\s\S]*?)\n```/ },
  ];

  for (const { type, regex } of fences) {
    const match = content.match(regex);
    if (match) {
      const text = content.replace(match[0], '').trim();
      return {
        text,
        artifact: {
          type,
          title: `${type.toUpperCase()} Artifact`,
          content: match[1].trim(),
        },
      };
    }
  }
  return { text: content, artifact: null };
}

export function usePlaygroundManager() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('raw');
  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate) ?? TEMPLATES[0];

  const [systemPrompt, setSystemPrompt] = useState(currentTemplate.systemPrompt);
  const [messages, setMessages] = useState<Message[]>([
    { id: uid(), role: 'user', content: currentTemplate.starterMessage },
  ]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [model, setModel] = useState(getDefaultAgentModel().id);
  const [systemExpanded, setSystemExpanded] = useState(true);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [leftTab, setLeftTab] = useState<LeftTab>('prompt');
  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [splitPos, setSplitPos] = useState(42);

  const applyTemplate = useCallback((id: TemplateId) => {
    const t = TEMPLATES.find((tpl) => tpl.id === id);
    if (!t) return;
    setActiveTemplate(id);
    setSystemPrompt(t.systemPrompt);
    setMessages([{ id: uid(), role: 'user', content: t.starterMessage }]);
    setStreamText('');
    setArtifact(null);
    setError(null);
  }, []);

  const buildMessages = useCallback((): ChatCompletionMessage[] => {
    const out: ChatCompletionMessage[] = [];
    if (systemPrompt.trim()) {
      out.push({ role: 'system', content: systemPrompt.trim() });
    }
    for (const msg of messages) {
      out.push({ role: msg.role, content: msg.content });
    }
    return out;
  }, [systemPrompt, messages]);

  const handleRun = useCallback(async () => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
      return;
    }
    setIsStreaming(true);
    setStreamText('');
    setArtifact(null);
    setError(null);
    setRightTab('console');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const body = {
        model,
        messages: buildMessages(),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      const base = ALLTERNIT_AI_URL || window.location.origin;
      const res = await fetch(`${base}/api/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Allternit AI error: ${res.status} ${res.statusText} — ${text}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content || '';
      const { text, artifact: extracted } = extractArtifact(content);
      setStreamText(text || content);
      if (extracted) {
        setArtifact(extracted);
        setRightTab('preview');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('abort')) {
        setStreamText((prev) => prev + '\n[stopped]');
      } else {
        setError(message);
        setStreamText(`Error: ${message}`);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, model, temperature, maxTokens, buildMessages, messages, systemPrompt]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant') => {
    setMessages((prev) => [...prev, { id: uid(), role, content: '' }]);
  }, []);
  
  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
  }, []);
  
  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    activeTemplate,
    setActiveTemplate,
    currentTemplate,
    systemPrompt,
    setSystemPrompt,
    messages,
    setMessages,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    model,
    setModel,
    systemExpanded,
    setSystemExpanded,
    isStreaming,
    streamText,
    artifact,
    error,
    leftTab,
    setLeftTab,
    rightTab,
    setRightTab,
    splitPos,
    setSplitPos,
    applyTemplate,
    handleRun,
    addMessage,
    updateMessage,
    removeMessage,
  };
}
