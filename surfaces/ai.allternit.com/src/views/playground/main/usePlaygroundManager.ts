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
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, []);

  const handleRun = useCallback(() => {
    if (isStreaming) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      setIsStreaming(false);
      return;
    }
    setIsStreaming(true);
    setStreamText('');
    setArtifact(null);
    setRightTab('console');

    const demo = currentTemplate.demoArtifact;
    const intro = `I'll create that for you now.\n\n\`\`\`${demo.type}\n`;
    const full = intro + demo.content + '\n```\n';
    let i = 0;
    let accumulated = '';
    const CHUNK = 60;
    const TICK  = 30;

    streamIntervalRef.current = setInterval(() => {
      if (i >= full.length) {
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        setIsStreaming(false);
        setArtifact(demo);
        setRightTab('preview');
        return;
      }
      const chunk = full.slice(i, Math.min(i + CHUNK, full.length));
      i += CHUNK;
      accumulated += chunk;
      setStreamText(accumulated);
    }, TICK);
  }, [isStreaming, currentTemplate]);

  useEffect(() => () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
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
