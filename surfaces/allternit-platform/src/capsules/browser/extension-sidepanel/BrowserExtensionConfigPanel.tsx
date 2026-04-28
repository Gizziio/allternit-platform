"use client";

import React, { useState } from "react";
import type { ExtensionSidepanelConfigViewProps } from "./ExtensionSidepanelShell.types";

export function BrowserExtensionConfigPanel({
  config,
  copy,
  pageLabel,
  onSave,
  onBack,
}: ExtensionSidepanelConfigViewProps) {
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [baseURL, setBaseURL] = useState(config.baseURL || "");
  const [model, setModel] = useState(config.model || "");
  const [language, setLanguage] = useState(config.language || "en-US");
  const [maxSteps, setMaxSteps] = useState<number | undefined>(config.maxSteps ?? undefined);
  const [systemInstruction, setSystemInstruction] = useState(config.systemInstruction || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        apiKey: apiKey || undefined,
        baseURL: baseURL || undefined,
        model: model || undefined,
        language,
        maxSteps: maxSteps || null,
        systemInstruction: systemInstruction || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <button
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
          <p className="text-[11px] uppercase tracking-wider opacity-60">{copy.settingsEyebrow}</p>
          <h2 className="text-sm font-medium">{copy.settingsTitle}</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <p className="text-xs opacity-60">{copy.settingsDescription}</p>

        <div className="space-y-1">
          <label className="text-xs font-medium">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Base URL</label>
          <input
            type="text"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o"
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          >
            <option value="en-US">English</option>
            <option value="zh-CN">中文</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Max Steps</label>
          <input
            type="number"
            value={maxSteps ?? ""}
            onChange={(e) => setMaxSteps(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Unlimited"
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">System Instruction</label>
          <textarea
            value={systemInstruction}
            onChange={(e) => setSystemInstruction(e.target.value)}
            placeholder="Optional system prompt..."
            rows={3}
            className="w-full rounded-md px-2.5 py-1.5 text-sm outline-none border resize-none"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }}
          />
        </div>
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <button
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
