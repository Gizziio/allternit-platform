import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { BotModeModelPickerUI } from "./BotModeModelPicker";
import type { BotModeProvider, BotModelScope } from "@/lib/bots/bot-mode-model";

const providers: BotModeProvider[] = [
  {
    id: "claude-cli",
    name: "Claude Code",
    installed: true,
    available: true,
    version: "2.1.266 (Claude Code)",
    account: "soni@example.com · workspace",
    models: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", default: true },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    installed: true,
    available: true,
    models: [
      { id: "gpt-6-astra", name: "Astra", default: true },
      { id: "gpt-5.6-sol", name: "Sol" },
    ],
  },
  {
    id: "kimi-cli",
    name: "Kimi CLI",
    installed: false,
    available: false,
    reason: "kimi not found on PATH. Install it, then retry.",
    models: [{ id: "kimi-k2.5", name: "Kimi K2.5" }],
  },
  {
    id: "xai",
    name: "xAI",
    installed: true,
    available: true,
    models: [{ id: "grok-4", name: "Grok 4", default: true }],
  },
  {
    id: "ollama",
    name: "Ollama",
    installed: true,
    available: true,
    models: [
      { id: "llama3.2", name: "llama3.2", default: true },
      { id: "qwen2.5", name: "qwen2.5" },
    ],
  },
];

function Frame03Picker() {
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState<BotModelScope>("thread");
  const [providerId, setProviderId] = useState("claude-cli");
  const [modelId, setModelId] = useState("claude-sonnet-4-6");
  return (
    <div className="flex min-h-[560px] items-start justify-end bg-[#0b0d10] p-8">
      <BotModeModelPickerUI
        providers={providers}
        selectedProviderId={providerId}
        selectedModelId={modelId}
        scope={scope}
        open={open}
        showScope
        usageLine="12,400 requests · 1.5k tokens · $1.20"
        onOpenChange={setOpen}
        onSelectRail={setProviderId}
        onPickModel={(nextProvider, nextModel) => {
          setProviderId(nextProvider);
          setModelId(nextModel);
        }}
        onScope={setScope}
      />
    </div>
  );
}

const meta: Meta<typeof Frame03Picker> = {
  title: "Bots/BotModeModelPicker",
  component: Frame03Picker,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof Frame03Picker>;

export const Frame03Parity: Story = {};

export const UnavailableKimi: Story = {
  render: () => (
    <div className="flex min-h-[560px] items-start justify-end bg-[#0b0d10] p-8">
      <BotModeModelPickerUI
        providers={providers}
        selectedProviderId="kimi-cli"
        selectedModelId="kimi-k2.5"
        scope="thread"
        open
        showScope
        onOpenChange={() => undefined}
        onSelectRail={() => undefined}
        onPickModel={() => undefined}
        onScope={() => undefined}
        onConnectProvider={() => undefined}
      />
    </div>
  ),
};
