import { SuggestionItem } from "@/components/agent-elements/input/suggestions";
import { getDefaultAgentModel, getLatestAgentModel } from "@/lib/agents/agent-models";

export const THEME = {
  bg: 'var(--surface-canvas)',
  bgGradient: 'linear-gradient(to top, color-mix(in srgb, var(--surface-canvas) 94%, transparent) 60%, transparent)',
  bgInput: 'var(--chat-composer-bg)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-chat)',
  borderSubtle: 'var(--ui-border-muted)',
};

// MODELS[0] is the platform's zen-tier free default and the ultimate
// fallback when no model is selected (see ChatView.tsx). The rest are
// registry-derived so ids stay valid gateway references — a bare
// "claude-3-5-sonnet"/"deepseek-r1" (no provider prefix, wrong version
// separator) would be rejected by the gateway if ever selected.
export const MODELS = [
  { id: "kimi/kimi-for-coding", name: "Kimi K2.5 (Coding)", provider: "kimi" },
  { id: getDefaultAgentModel().id, name: getDefaultAgentModel().name, provider: getDefaultAgentModel().provider },
  { id: getLatestAgentModel('anthropic').id, name: getLatestAgentModel('anthropic').name, provider: "anthropic" as const },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
] as const;

export const EMPTY_STATE_SUGGESTIONS: SuggestionItem[] = [
  { id: "week-plan", label: "Plan my week", value: "Help me plan my week with priorities and a realistic schedule." },
  { id: "meeting-summary", label: "Summarize a meeting", value: "Summarize my last meeting into actions, risks, and follow-ups." },
  { id: "todo-list", label: "Create a todo list", value: "Create a prioritized todo list from my current goals." },
  { id: "code-review", label: "Explain this code", value: "Explain this code, identify risks, and suggest improvements." },
];
