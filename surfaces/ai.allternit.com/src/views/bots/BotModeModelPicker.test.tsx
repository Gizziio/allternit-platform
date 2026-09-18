import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BotModeModelPickerUI } from "./BotModeModelPicker";
import type { BotModeProvider } from "@/lib/bots/bot-mode-model";

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => <span data-icon="p" />;
  return {
    ArrowClockwise: Icon,
    CaretDown: Icon,
    CaretRight: Icon,
    Check: Icon,
    CircleNotch: Icon,
    MagnifyingGlass: Icon,
    Warning: Icon,
  };
});

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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
    ],
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    installed: true,
    available: true,
    models: [{ id: "gpt-6-astra", name: "Astra", default: true }],
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
    id: "ollama",
    name: "Ollama",
    installed: true,
    available: true,
    models: [{ id: "llama3.2", name: "llama3.2" }],
  },
];

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof BotModeModelPickerUI>> = {},
) {
  const onPickModel = vi.fn();
  const onScope = vi.fn();
  const onSelectRail = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <BotModeModelPickerUI
      providers={providers}
      selectedProviderId="claude-cli"
      selectedModelId="claude-sonnet-4-6"
      scope="thread"
      open
      showScope
      onOpenChange={onOpenChange}
      onSelectRail={onSelectRail}
      onPickModel={onPickModel}
      onScope={onScope}
      {...overrides}
    />,
  );
  return { onPickModel, onScope, onSelectRail, onOpenChange };
}

describe("BotModeModelPickerUI", () => {
  it("shows Cloud/Local rail, thread scope, and the current model", () => {
    renderPicker();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Only this thread" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Thread + bot default" })).toBeInTheDocument();
    expect(screen.getByText("Other threads and groups keep their model.")).toBeInTheDocument();
    expect(screen.getByText("2.1.266 (Claude Code)")).toBeInTheDocument();
    expect(screen.getByText("soni@example.com · workspace")).toBeInTheDocument();
    expect(screen.getByText("Choose a model for this thread.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use a local model" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select model" })).toHaveTextContent(
      "Claude Code · Claude Sonnet 4.6",
    );
    // Effort chips are hidden: no per-send path delivers effort to the engine.
    expect(screen.queryByRole("group", { name: "Reasoning effort" })).not.toBeInTheDocument();
  });

  it("dims an unavailable engine and shows the reason instead of crashing", () => {
    const { onSelectRail } = renderPicker({ selectedProviderId: "kimi-cli", selectedModelId: "kimi-k2.5" });
    fireEvent.click(screen.getByRole("button", { name: /Kimi CLI/ }));
    expect(onSelectRail).toHaveBeenCalledWith("kimi-cli");
    expect(
      screen.getAllByText("kimi not found on PATH. Install it, then retry.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Kimi K2.5" })).not.toBeInTheDocument();
  });

  it("blocked engine offers a real Connect action when the callback is wired", () => {
    const onConnectProvider = vi.fn();
    const { onOpenChange } = renderPicker({
      selectedProviderId: "kimi-cli",
      selectedModelId: "kimi-k2.5",
      onConnectProvider,
    });
    fireEvent.click(screen.getByRole("button", { name: /Connect Kimi CLI/ }));
    expect(onConnectProvider).toHaveBeenCalledWith("kimi-cli");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits the Connect action when no callback is provided", () => {
    renderPicker({ selectedProviderId: "kimi-cli", selectedModelId: "kimi-k2.5" });
    fireEvent.click(screen.getByRole("button", { name: /Kimi CLI/ }));
    expect(screen.queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument();
  });

  it("renders the usage footer when a real usage line is provided", () => {
    renderPicker({ usageLine: "12,400 requests · 1.5k tokens · $1.20" });
    expect(screen.getByText("12,400 requests · 1.5k tokens · $1.20")).toBeInTheDocument();
  });

  it("omits the usage footer when no usage line is provided", () => {
    renderPicker({ usageLine: null });
    expect(screen.queryByText(/requests · /)).not.toBeInTheDocument();
  });

  it("surfaces a save error in an alert banner", () => {
    renderPicker({ error: "Could not save the model change: backend offline" });
    expect(screen.getByRole("alert")).toHaveTextContent("backend offline");
  });

  it("picks a model and writes bot-default scope", () => {
    const { onPickModel, onScope } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Claude Opus 4.6" }));
    expect(onPickModel).toHaveBeenCalledWith("claude-cli", "claude-opus-4-6");
    fireEvent.click(screen.getByRole("button", { name: "Thread + bot default" }));
    expect(onScope).toHaveBeenCalledWith("bot");
  });

  it("Use a local model moves the rail to Ollama", () => {
    const { onSelectRail } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Use a local model" }));
    expect(onSelectRail).toHaveBeenCalledWith("ollama");
  });
});

describe("BotChatSessionView wiring", () => {
  it("uses BotModeModelPicker, mounts ProviderGallery, and does not mount the Chat catalog dialog", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "BotChatSessionView.tsx"),
      "utf8",
    );
    expect(src).toMatch(/BotModeModelPicker/);
    expect(src).toMatch(/ProviderGallery/);
    expect(src).not.toMatch(/import \{ ModelPicker/);
    expect(src).not.toMatch(/<ModelPicker[\s>]/);
    expect(src).not.toMatch(/BottomDock|ModeDock|FabricAppChrome/);
  });

  it("no longer writes the global Chat/Cowork default (selectModel coupling removed)", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "BotChatSessionView.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/selectModel\(/);
    expect(src).not.toMatch(/useModelSelection\(/);
    expect(src).not.toMatch(/ModelSelectionProvider/);
  });
});
