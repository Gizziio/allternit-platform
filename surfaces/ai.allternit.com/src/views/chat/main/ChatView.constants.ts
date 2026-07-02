import { SuggestionItem } from "@/components/agent-elements/input/suggestions";

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

export const MODELS = [
  { id: "kimi/kimi-for-coding", name: "Kimi K2.5 (Coding)", provider: "kimi" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
] as const;

export const EMPTY_STATE_SUGGESTIONS: SuggestionItem[] = [
  { id: "week-plan", label: "Plan my week", value: "Help me plan my week with priorities and a realistic schedule." },
  { id: "meeting-summary", label: "Summarize a meeting", value: "Summarize my last meeting into actions, risks, and follow-ups." },
  { id: "todo-list", label: "Create a todo list", value: "Create a prioritized todo list from my current goals." },
  { id: "code-review", label: "Explain this code", value: "Explain this code, identify risks, and suggest improvements." },
];
