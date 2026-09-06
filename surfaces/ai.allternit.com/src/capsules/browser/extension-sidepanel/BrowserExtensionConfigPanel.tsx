"use client";

import React, { useState } from "react";
import type { ExtensionSidepanelConfigViewProps } from "./ExtensionSidepanelShell.types";
import { useBrowserAgentStore } from "../browserAgent.store";
import { ACI_ENGINE_LABEL, type AciEngine } from "@/lib/aci-runtime";

export function BrowserExtensionConfigPanel({
  config,
  copy,
  pageLabel,
  onSave,
  onBack,
}: ExtensionSidepanelConfigViewProps) {
  const [language, setLanguage] = useState(config.language || "en-US");
  const [maxSteps, setMaxSteps] = useState<number | undefined>(config.maxSteps ?? undefined);
  const [experimentalLlmsTxt, setExperimentalLlmsTxt] = useState(Boolean(config.experimentalLlmsTxt));
  const [saving, setSaving] = useState(false);
  const aciEngine = useBrowserAgentStore((s) => s.aciEngine);
  const setAciEngine = useBrowserAgentStore((s) => s.setAciEngine);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        language,
        maxSteps: maxSteps || null,
        experimentalLlmsTxt,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <button type="button"
          onClick={onBack}
          className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:opacity-80"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-[12px] uppercase tracking-wider opacity-60">{copy.settingsEyebrow}</p>
          <h2 className="text-sm font-medium">{copy.settingsTitle}</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <p className="text-xs opacity-60">{copy.settingsDescription}</p>

        <div
          className="rounded-lg border p-3 space-y-2"
          style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium">Brain</div>
              <div className="text-sm">{config.brainLabel || "Allternit/Gizzi platform brain"}</div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--background)", color: "var(--muted-foreground)" }}>
              {config.connectionLabel || "Managed"}
            </span>
          </div>
          <div className="text-xs opacity-70">
            Model selection, provider credentials, and system prompt are owned by the platform brain/runtime.
            Browser mode attaches the current tab to that harness instead of creating a separate extension LLM.
          </div>
          <div className="text-[11px] opacity-60">
            Harness: {config.harnessLabel || "page-agent + computer-use"}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">Computer-use engine</div>
          <select
            aria-label="Computer-use engine"
            value={aciEngine}
            onChange={(event) => setAciEngine(event.target.value as AciEngine)}
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          >
            {(Object.keys(ACI_ENGINE_LABEL) as AciEngine[]).map((engine) => (
              <option key={engine} value={engine}>
                {ACI_ENGINE_LABEL[engine]}
              </option>
            ))}
          </select>
          <p className="text-[11px] opacity-60">
            Allternit computer-use is the local engine. Sub-agent spawns a worker. Page-agent only attaches this tab.
          </p>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">Language</div>
          <select aria-label="Selection" value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          >
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">Max Steps</div>
          <input aria-label="Input" type="number"
            value={maxSteps ?? ""}
            onChange={(e) => setMaxSteps(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Unlimited"
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-2" style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}>
          <span className="text-xs font-medium">Experimental llms.txt support</span>
          <input
            aria-label="Experimental llms.txt support"
            type="checkbox"
            checked={experimentalLlmsTxt}
            onChange={(event) => setExperimentalLlmsTxt(event.target.checked)}
          />
        </label>

        <div className="rounded-md border p-2.5 text-[11px] opacity-70" style={{ borderColor: "var(--border)" }}>
          To change model, credentials, or system instructions, update the Allternit platform brain/Gizzi runtime settings.
          This pane only controls how the attached browser tab participates in that run.
        </div>
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-md px-3 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
