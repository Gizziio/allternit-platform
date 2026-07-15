"use client";

import React from "react";
import { Plus, Sparkle } from "@phosphor-icons/react";
import { STUDIO_THEME } from "../AgentView.constants";

interface EmptyAgentStateProps {
  onCreate: () => void;
  onCreateFromTemplate: (template: any) => void;
}

export function EmptyAgentState({ onCreate, onCreateFromTemplate }: EmptyAgentStateProps) {
  const templates = [
    {
      id: 'coding',
      name: 'Coding Assistant',
      description: 'Expert in multiple programming languages and architectures.',
      setup: 'coding',
      capabilities: ['code-generation', 'file-operations', 'terminal'],
      color: 'var(--status-info)',
      mascotTemplate: 'bot',
      systemPrompt: 'You are an expert senior software engineer...'
    },
    {
      id: 'research',
      name: 'Research Analyst',
      description: 'Synthesizes information and provides data-driven insights.',
      setup: 'research',
      capabilities: ['web-search', 'api-integration', 'reasoning'],
      color: 'var(--status-success)',
      mascotTemplate: 'orb',
      systemPrompt: 'You are a meticulous research analyst...'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="size-20  rounded-full bg-[var(--surface-hover)] flex items-center justify-center mb-6 border border-[var(--border-subtle)]">
        <Sparkle size={40} className="text-muted-foreground opacity-50" />
      </div>
      <h3 className="text-xl font-medium mb-2" style={{ color: STUDIO_THEME.textPrimary }}>No Agents Found</h3>
      <p className="text-sm max-w-sm mb-8" style={{ color: STUDIO_THEME.textSecondary }}>
        You haven&apos;t created any AI agents yet. Start by creating a custom agent or choose a template.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <button type="button"
          onClick={onCreate}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all"
          style={{ 
            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
            color: 'var(--ui-text-inverse)'
          }}
        >
          <Plus size={18} />
          Create Custom Agent
        </button>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Quick Templates</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(template => (
            <button type="button"
              key={template.id}
              onClick={() => onCreateFromTemplate(template)}
              className="text-left p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] hover:bg-[var(--surface-panel)] transition-colors"
            >
              <h4 className="font-semibold mb-1" style={{ color: STUDIO_THEME.textPrimary }}>{template.name}</h4>
              <p className="text-sm" style={{ color: STUDIO_THEME.textSecondary }}>{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
