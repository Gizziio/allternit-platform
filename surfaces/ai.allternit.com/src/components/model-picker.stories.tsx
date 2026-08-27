import type { Meta, StoryObj } from "@storybook/react";
import { ModelPickerUI, type ModelSelection } from "./model-picker";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import type { ProviderAuthStatus } from "@/integration/api-client";

const mockProviders: ProviderAuthStatus[] = [
  {
    provider_id: "claude",
    status: "ok",
    authenticated: true,
    auth_profile_id: "claude-auth",
    chat_profile_ids: ["claude-acp"],
    details: { model_count: 3 },
  },
  {
    provider_id: "openai",
    status: "ok",
    authenticated: true,
    auth_profile_id: "openai-auth",
    chat_profile_ids: ["openai-acp"],
    details: { model_count: 2 },
  },
  {
    provider_id: "gemini",
    status: "ok",
    authenticated: true,
    auth_profile_id: "gemini-auth",
    chat_profile_ids: ["gemini-acp"],
    details: { model_count: 1 },
  },
  {
    provider_id: "ollama",
    status: "ok",
    authenticated: true,
    auth_profile_id: "ollama-auth",
    chat_profile_ids: ["ollama-acp"],
    details: { model_count: 2 },
  },
  {
    provider_id: "grok",
    status: "missing",
    authenticated: false,
    auth_profile_id: null,
    chat_profile_ids: [],
  },
  {
    provider_id: "kimi",
    status: "missing",
    authenticated: false,
    auth_profile_id: null,
    chat_profile_ids: [],
  },
  {
    provider_id: "deepseek",
    status: "missing",
    authenticated: false,
    auth_profile_id: null,
    chat_profile_ids: [],
  },
];

const mockModels: ModelOption[] = [
  {
    id: "claude/claude-sonnet-4",
    name: "Claude Sonnet 4",
    providerId: "claude",
    providerName: "Claude",
    description: "Balanced reasoning and speed",
    capabilities: ["vision", "code"],
    context_window: 200000,
  },
  {
    id: "claude/claude-opus-4",
    name: "Claude Opus 4",
    providerId: "claude",
    providerName: "Claude",
    description: "Deep reasoning and coding",
    capabilities: ["vision", "code", "long-context"],
    context_window: 200000,
  },
  {
    id: "claude/claude-haiku-4",
    name: "Claude Haiku 4",
    providerId: "claude",
    providerName: "Claude",
    description: "Fast and lightweight",
    capabilities: ["vision"],
    context_window: 200000,
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    providerId: "openai",
    providerName: "OpenAI",
    description: "General purpose",
    capabilities: ["vision", "code"],
    context_window: 128000,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    providerId: "openai",
    providerName: "OpenAI",
    description: "Cost-efficient",
    capabilities: ["vision"],
    context_window: 128000,
  },
  {
    id: "gemini/gemini-2-5-pro",
    name: "Gemini 2.5 Pro",
    providerId: "gemini",
    providerName: "Gemini",
    description: "Google's flagship",
    capabilities: ["vision", "long-context"],
    context_window: 1000000,
  },
  {
    id: "ollama/llama3.1",
    name: "Llama 3.1",
    providerId: "ollama",
    providerName: "Ollama",
    description: "Local Ollama model",
    context_window: 128000,
  },
  {
    id: "ollama/qwen2.5",
    name: "Qwen 2.5",
    providerId: "ollama",
    providerName: "Ollama",
    description: "Local Ollama model",
    context_window: 32000,
  },
];

const meta: Meta<typeof ModelPickerUI> = {
  title: "Chat/ModelPicker",
  component: ModelPickerUI,
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0a0a0b" }],
    },
  },
  args: {
    open: true,
    onOpenChange: () => {},
    onSelect: (s: ModelSelection) => console.log("selected", s),
    onCancel: () => {},
    onOpenProviderConnect: () => console.log("connect provider"),
    onOpenModelLab: () => console.log("open model lab"),
    availableModels: mockModels,
    providers: mockProviders,
    authenticatedProviders: mockProviders.filter((p) => p.authenticated),
    providersLoading: false,
    providersError: null,
    validationResult: null,
    validationLoading: false,
    validateModel: async () => ({ valid: false }),
    selectedModelId: "claude/claude-sonnet-4",
  },
};

export default meta;

type Story = StoryObj<typeof ModelPickerUI>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    availableModels: [],
    providers: [],
    authenticatedProviders: [],
    providersLoading: true,
  },
};

export const Empty: Story = {
  args: {
    availableModels: [],
    providers: mockProviders.filter((p) => !p.authenticated),
    authenticatedProviders: [],
  },
};

export const CustomModel: Story = {
  args: {
    availableModels: [],
    providers: mockProviders.filter((p) => p.authenticated),
    authenticatedProviders: mockProviders.filter((p) => p.authenticated),
  },
};

export const Expanded: Story = {
  args: {
    availableModels: mockModels,
    providers: mockProviders,
    authenticatedProviders: mockProviders.filter((p) => p.authenticated),
    initialExpandedProviders: ["Claude"],
  },
};

export const MultiSelect: Story = {
  args: {
    availableModels: mockModels,
    providers: mockProviders,
    authenticatedProviders: mockProviders.filter((p) => p.authenticated),
    multiSelect: true,
    onSelectMultiple: (selections) => console.log("selected providers", selections),
  },
};
