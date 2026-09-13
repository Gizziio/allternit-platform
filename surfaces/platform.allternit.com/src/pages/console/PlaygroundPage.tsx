import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlayIcon,
  StopIcon,
  SourceCodeIcon,
  LayoutIcon,
  ArrowLeftRightIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/lib/api-client";
import { CodeTemplateBlock } from "@/components/console-ui";
import { fetchConsoleModels, type ConsoleModel } from "@/lib/console-models";
import {
  loadModelAutoPolicy,
  saveModelAutoPolicy,
  resolveAutoModel,
  type ModelAutoPolicy,
} from "@/lib/model-auto-policy";
import { PLAYGROUND_TEMPLATES } from "@/lib/playground-templates";
import type { ChatCompletionMessage } from "@/lib/console-gateway";
import { MessagesEditor, type EditableMessage } from "./playground/MessagesEditor";
import { ModelPicker } from "./playground/ModelPicker";
import { OutputPane } from "./playground/OutputPane";
import { useChatRun } from "./playground/useChatRun";

const STORAGE_KEY = "allternit:console:playground";

const INPUT_CLASS =
  "w-full rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]";

const SEGMENT_CLASS =
  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors";

interface PersistedState {
  model: string;
  systemPrompt: string;
  messages: EditableMessage[];
  temperature: number;
  maxTokens: number;
}

function loadPersisted(): PersistedState {
  const fallback: PersistedState = {
    model: "auto",
    systemPrompt: "",
    messages: [
      {
        id: "msg-initial",
        role: "user",
        content: "",
      },
    ],
    temperature: 0.7,
    maxTokens: 4096,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      model: typeof parsed.model === "string" ? parsed.model : fallback.model,
      systemPrompt:
        typeof parsed.systemPrompt === "string"
          ? parsed.systemPrompt
          : fallback.systemPrompt,
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.filter(
            (m): m is EditableMessage =>
              !!m &&
              typeof m.id === "string" &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
        : fallback.messages,
      temperature:
        typeof parsed.temperature === "number"
          ? parsed.temperature
          : fallback.temperature,
      maxTokens:
        typeof parsed.maxTokens === "number"
          ? parsed.maxTokens
          : fallback.maxTokens,
    };
  } catch {
    return fallback;
  }
}

function buildMessages(
  systemPrompt: string,
  messages: EditableMessage[]
): ChatCompletionMessage[] {
  const out: ChatCompletionMessage[] = [];
  if (systemPrompt.trim()) {
    out.push({ role: "system", content: systemPrompt.trim() });
  }
  for (const m of messages) {
    if (m.content.trim()) out.push({ role: m.role, content: m.content });
  }
  return out;
}

function gatewayBase(): string {
  return String(
    import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || "https://api.allternit.com"
  ).replace(/\/+$/, "");
}

export function PlaygroundPage(): React.ReactNode {
  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted);
  const [view, setView] = useState<"form" | "code">("form");
  const [compare, setCompare] = useState(false);

  const [models, setModels] = useState<ConsoleModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<ModelAutoPolicy>(loadModelAutoPolicy);

  const single = useChatRun();
  const laneA = useChatRun();
  const laneB = useChatRun();

  const [laneBConfig, setLaneBConfig] = useState({
    model: "auto",
    temperature: 0.7,
    maxTokens: 4096,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Persistence is best-effort.
    }
  }, [persisted]);

  useEffect(() => {
    let active = true;
    fetchConsoleModels()
      .then((list) => {
        if (active) setModels(list);
      })
      .catch((err) => {
        if (active) setModelsError(formatApiError(err, "model catalog"));
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePolicyChange = useCallback((next: ModelAutoPolicy) => {
    setPolicy(next);
    saveModelAutoPolicy(next);
  }, []);

  const resolveModel = useCallback(
    (model: string): string | null =>
      model === "auto" ? resolveAutoModel(models, policy) : model,
    [models, policy]
  );

  const effectiveMessages = useMemo(
    () => buildMessages(persisted.systemPrompt, persisted.messages),
    [persisted.systemPrompt, persisted.messages]
  );

  const anyRunning = single.state.running || laneA.state.running || laneB.state.running;

  const handleRunSingle = useCallback(async () => {
    const model = resolveModel(persisted.model);
    if (!model) {
      return;
    }
    await single.run({
      model,
      messages: effectiveMessages,
      temperature: persisted.temperature,
      maxTokens: persisted.maxTokens,
    });
  }, [resolveModel, persisted, effectiveMessages, single]);

  const handleRunCompare = useCallback(async () => {
    const modelA = resolveModel(persisted.model);
    const modelB = resolveModel(laneBConfig.model);
    // Sequential, per the compare-mode contract — each lane reports its own error.
    if (modelA) {
      await laneA.run({
        model: modelA,
        messages: effectiveMessages,
        temperature: persisted.temperature,
        maxTokens: persisted.maxTokens,
      });
    }
    if (modelB) {
      await laneB.run({
        model: modelB,
        messages: effectiveMessages,
        temperature: laneBConfig.temperature,
        maxTokens: laneBConfig.maxTokens,
      });
    }
  }, [resolveModel, persisted, laneBConfig, effectiveMessages, laneA, laneB]);

  const handleStop = useCallback(() => {
    single.stop();
    laneA.stop();
    laneB.stop();
  }, [single, laneA, laneB]);

  const curlSnippet = useMemo(() => {
    const body = {
      model: resolveModel(persisted.model) ?? persisted.model,
      messages: effectiveMessages,
      temperature: persisted.temperature,
      max_tokens: persisted.maxTokens,
      stream: true,
    };
    return [
      `curl ${gatewayBase()}/v1/chat/completions \\`,
      '  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      `  -d '${JSON.stringify(body, null, 2)}'`,
    ].join("\n");
  }, [resolveModel, persisted, effectiveMessages]);

  const applyTemplate = useCallback((templateId: string) => {
    const template = PLAYGROUND_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setPersisted((prev) => ({
      ...prev,
      systemPrompt: template.systemPrompt,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: "user",
          content: template.starterMessage,
        },
      ],
    }));
    single.reset();
  }, [single]);

  const autoUnresolved = persisted.model === "auto" && resolveModel("auto") === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
            Playground
          </h1>
          <p className="m-0 mt-1 text-[13px] text-[var(--text-secondary)]">
            Try models, tune parameters, and iterate on prompts before shipping
            them to code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5">
            <button
              type="button"
              onClick={() => setView("form")}
              className={cn(
                SEGMENT_CLASS,
                view === "form"
                  ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <HugeiconsIcon icon={LayoutIcon} size={13} />
              Form
            </button>
            <button
              type="button"
              onClick={() => setView("code")}
              className={cn(
                SEGMENT_CLASS,
                view === "code"
                  ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <HugeiconsIcon icon={SourceCodeIcon} size={13} />
              Code
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-solid px-3 py-1.5 text-[12px] font-semibold transition-colors",
              compare
                ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <HugeiconsIcon icon={ArrowLeftRightIcon} size={13} />
            Compare
          </button>
        </div>
      </div>

      {view === "code" ? (
        <div className="space-y-4">
          <p className="m-0 text-[13px] text-[var(--text-secondary)]">
            This is the exact request the form sends — a streaming chat
            completion against the gateway with a virtual key.
          </p>
          <CodeTemplateBlock language="bash" code={curlSnippet} />
        </div>
      ) : compare ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
              <ModelPicker
                idPrefix="lane-a"
                models={models}
                modelsError={modelsError}
                value={persisted.model}
                onChange={(model) => setPersisted((p) => ({ ...p, model }))}
                policy={policy}
                onPolicyChange={handlePolicyChange}
              />
              <ParamRow
                temperature={persisted.temperature}
                maxTokens={persisted.maxTokens}
                onTemperature={(v) => setPersisted((p) => ({ ...p, temperature: v }))}
                onMaxTokens={(v) => setPersisted((p) => ({ ...p, maxTokens: v }))}
                idPrefix="lane-a"
              />
              <OutputPane
                title="Output A"
                state={laneA.state}
                idleCaption="Run to see output for this model."
              />
            </div>
            <div className="space-y-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
              <ModelPicker
                idPrefix="lane-b"
                models={models}
                modelsError={modelsError}
                value={laneBConfig.model}
                onChange={(model) => setLaneBConfig((c) => ({ ...c, model }))}
                policy={policy}
                onPolicyChange={handlePolicyChange}
              />
              <ParamRow
                temperature={laneBConfig.temperature}
                maxTokens={laneBConfig.maxTokens}
                onTemperature={(v) => setLaneBConfig((c) => ({ ...c, temperature: v }))}
                onMaxTokens={(v) => setLaneBConfig((c) => ({ ...c, maxTokens: v }))}
                idPrefix="lane-b"
              />
              <OutputPane
                title="Output B"
                state={laneB.state}
                idleCaption="Run to see output for this model."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RunButton
              running={laneA.state.running || laneB.state.running}
              onRun={() => void handleRunCompare()}
              onStop={handleStop}
              disabled={effectiveMessages.length === 0 || autoUnresolved}
            />
            {autoUnresolved && <AutoUnresolvedNote />}
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="pg-system"
                className="text-[12px] font-semibold text-[var(--text-secondary)]"
              >
                System prompt
              </label>
              <textarea
                id="pg-system"
                value={persisted.systemPrompt}
                onChange={(e) =>
                  setPersisted((p) => ({ ...p, systemPrompt: e.target.value }))
                }
                placeholder="You are a helpful assistant."
                rows={3}
                className={cn(INPUT_CLASS, "resize-y font-mono text-[12px]")}
              />
            </div>

            <MessagesEditor
              messages={persisted.messages}
              onChange={(messages) => setPersisted((p) => ({ ...p, messages }))}
            />

            <ParamRow
              temperature={persisted.temperature}
              maxTokens={persisted.maxTokens}
              onTemperature={(v) => setPersisted((p) => ({ ...p, temperature: v }))}
              onMaxTokens={(v) => setPersisted((p) => ({ ...p, maxTokens: v }))}
              idPrefix="pg"
            />

            <ModelPicker
              idPrefix="pg"
              models={models}
              modelsError={modelsError}
              value={persisted.model}
              onChange={(model) => setPersisted((p) => ({ ...p, model }))}
              policy={policy}
              onPolicyChange={handlePolicyChange}
            />

            <div className="flex items-center gap-2">
              <RunButton
                running={single.state.running}
                onRun={() => void handleRunSingle()}
                onStop={handleStop}
                disabled={effectiveMessages.length === 0 || autoUnresolved}
              />
              {autoUnresolved && <AutoUnresolvedNote />}
            </div>

            <OutputPane
              title="Output"
              state={single.state}
              idleCaption="Run the request to see the model's response stream here."
            />
          </div>

          <aside className="space-y-2 lg:sticky lg:top-0">
            <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
              Start with a template
            </h2>
            <p className="m-0 text-[12px] text-[var(--text-tertiary)]">
              Fills the request form — nothing runs until you press Run.
            </p>
            <div className="space-y-2 pt-1">
              {PLAYGROUND_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  className="w-full rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-left transition-colors hover:border-[var(--accent-primary)]/40"
                >
                  <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                    {template.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {anyRunning && (
        <p className="m-0 text-[12px] text-[var(--text-tertiary)]">
          Requests are billed to your organization through the gateway.
        </p>
      )}
    </div>
  );
}

function ParamRow({
  temperature,
  maxTokens,
  onTemperature,
  onMaxTokens,
  idPrefix,
}: {
  temperature: number;
  maxTokens: number;
  onTemperature: (v: number) => void;
  onMaxTokens: (v: number) => void;
  idPrefix: string;
}): React.ReactNode {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-temp`}
          className="text-[12px] font-semibold text-[var(--text-secondary)]"
        >
          Temperature
        </label>
        <input
          id={`${idPrefix}-temp`}
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(e) => onTemperature(Number(e.target.value) || 0)}
          className={INPUT_CLASS}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-max-tokens`}
          className="text-[12px] font-semibold text-[var(--text-secondary)]"
        >
          Max tokens
        </label>
        <input
          id={`${idPrefix}-max-tokens`}
          type="number"
          min={1}
          value={maxTokens}
          onChange={(e) =>
            onMaxTokens(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}

function RunButton({
  running,
  onRun,
  onStop,
  disabled,
}: {
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  disabled: boolean;
}): React.ReactNode {
  return running ? (
    <button
      type="button"
      onClick={onStop}
      className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
    >
      <HugeiconsIcon icon={StopIcon} size={13} />
      Stop
    </button>
  ) : (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <HugeiconsIcon icon={PlayIcon} size={13} />
      Run
    </button>
  );
}

function AutoUnresolvedNote(): React.ReactNode {
  return (
    <span className="text-[12px] text-[var(--status-error)]">
      Auto policy resolves to no model — adjust the policy or pick a concrete
      model.
    </span>
  );
}

export default PlaygroundPage;
