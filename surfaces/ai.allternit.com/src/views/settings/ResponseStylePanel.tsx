"use client";

import React, { useEffect, useState } from 'react';
import { ArrowsClockwise, Check, WarningCircle } from '@phosphor-icons/react';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  agentPreferencesApi,
  type AgentPreferences,
  type AgentResponseStyle,
} from '@/lib/agents/agent-preferences-api';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ResponseStylePanel');

const STYLE_OPTIONS: Array<{
  value: AgentResponseStyle;
  label: string;
  description: string;
}> = [
  { value: 'concise', label: 'Concise', description: 'Short, direct answers with minimal preamble.' },
  { value: 'balanced', label: 'Balanced', description: 'A middle ground between brevity and explanation.' },
  { value: 'detailed', label: 'Detailed', description: 'Thorough answers with reasoning and context.' },
  { value: 'custom', label: 'Custom', description: 'Your instructions below define the response style.' },
];

interface PrefsSnapshot {
  style: AgentResponseStyle;
  customInstructions: string;
}

/**
 * Settings surface for the per-user agent response style. Saved through
 * PUT /api/v1/agent-preferences, which also syncs STYLE.md into agent
 * workspaces server-side — the chat bridge applies it on every chat.
 */
export function ResponseStylePanel(): React.ReactNode {
  const [style, setStyle] = useState<AgentResponseStyle>('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PrefsSnapshot>({ style: 'balanced', customInstructions: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (prefs: AgentPreferences) => {
    const next: PrefsSnapshot = {
      style: prefs.response_style,
      customInstructions: prefs.custom_instructions ?? '',
    };
    setStyle(next.style);
    setCustomInstructions(next.customInstructions);
    setUpdatedAt(prefs.updated_at ?? null);
    setSnapshot(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const prefs = await agentPreferencesApi.get();
        if (!cancelled) apply(prefs);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load response style preferences');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: PrefsSnapshot, revertTo: PrefsSnapshot | null) => {
    setIsSaving(true);
    setError(null);
    try {
      const prefs = await agentPreferencesApi.update({
        response_style: next.style,
        custom_instructions: next.customInstructions,
      });
      apply(prefs);
      setShowSaved(true);
      window.setTimeout(() => setShowSaved(false), 2000);
    } catch (e) {
      logger.error({ err: e }, 'Failed to save agent preferences');
      setError(e instanceof Error ? e.message : 'Failed to save response style preferences');
      // Roll the optimistic update back to the last server-confirmed state.
      if (revertTo) {
        setStyle(revertTo.style);
        setCustomInstructions(revertTo.customInstructions);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStyleSelect = (value: AgentResponseStyle) => {
    if (value === style || isSaving || isLoading) return;
    const previous = snapshot;
    // Optimistic: reflect the pick immediately, persist in the background.
    setStyle(value);
    void save({ style: value, customInstructions }, previous);
  };

  const instructionsDirty = customInstructions !== snapshot.customInstructions;

  return (
    <div className="space-y-6">
      <SectionHeading>Response style</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed -mt-3">
        Controls how agents respond across every chat. Saved to your account and synced
        into each agent&apos;s workspace automatically.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5">
          <WarningCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-[13px] text-red-500">{error}</span>
        </div>
      )}

      <SettingsCard
        title="Style"
        description="Pick how much detail agents put into their replies."
      >
        <div className="space-y-2">
          {STYLE_OPTIONS.map((option) => {
            const selected = style === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStyleSelect(option.value)}
                disabled={isLoading}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl border border-solid px-4 py-3 text-left cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  selected
                    ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-solid',
                    selected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-default)] bg-transparent text-transparent'
                  )}
                >
                  <Check size={10} weight="bold" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-[var(--text-primary)]">
                    {option.label}
                  </span>
                  <span className="block text-[12px] text-[var(--text-tertiary)] mt-0.5">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Custom instructions"
        description="Extra guidance appended to the response style. Applied to every agent chat."
      >
        <Textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          disabled={isLoading}
          rows={6}
          spellCheck={false}
          placeholder={
            style === 'custom'
              ? 'Describe how agents should respond — tone, format, length, things to avoid…'
              : 'Optional extra guidance on top of the selected style…'
          }
          className="w-full resize-y bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] font-mono leading-relaxed"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="text-[12px] text-[var(--text-tertiary)]">
            {isSaving ? (
              <span className="inline-flex items-center gap-1.5">
                <ArrowsClockwise size={12} className="animate-spin" />
                Saving…
              </span>
            ) : showSaved ? (
              <span className="inline-flex items-center gap-1 text-[var(--status-success)]">
                <Check size={12} weight="bold" />
                Saved
              </span>
            ) : updatedAt ? (
              `Last updated ${new Date(updatedAt).toLocaleString()}`
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void save({ style, customInstructions }, null)}
            disabled={isLoading || isSaving || !instructionsDirty}
            className={QUIET_BUTTON_CLASS}
          >
            Save instructions
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}
