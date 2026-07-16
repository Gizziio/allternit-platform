"use client";

import React from "react";
import { Plus, Sparkle } from "@phosphor-icons/react";

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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Sparkle size={48} className="mb-3 text-[var(--text-tertiary)] opacity-40" />
      <h3 className="mb-2 text-sm font-normal text-[var(--text-secondary)]">No agents yet.</h3>
      <p className="mb-6 max-w-sm text-xs text-[var(--text-tertiary)]">
        You haven&apos;t created any AI agents yet. Start by creating a custom agent or choose a template.
      </p>
      
      <div className="mb-12 flex flex-col gap-4 sm:flex-row">
        <button type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
        >
          <Plus size={18} />
          Create Custom Agent
        </button>
      </div>

      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Quick Templates</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(template => (
            <button type="button"
              key={template.id}
              onClick={() => onCreateFromTemplate(template)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-left transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md"
            >
              <h4 className="mb-1 font-semibold text-[var(--text-primary)]">{template.name}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{template.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
