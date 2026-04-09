"use client";

import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  EventCard,
} from "./extension-sidepanel/ExtensionSidepanelShell";
import type {
  ExtensionSidepanelConfigViewProps,
  ExtensionSidepanelHistoryDetailViewProps,
  ExtensionSidepanelHistoryListViewProps,
} from "./extension-sidepanel/ExtensionSidepanelShell.types";
import { useBrowserChatPaneStore } from "./browserChatPane.store";

const GITHUB_ICON_PATH =
  "M12 .297a12 12 0 0 0-3.794 23.39c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.334-5.467-5.931 0-1.311.469-2.382 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.042.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.839 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.48 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12 12 0 0 0 12 .297Z";

const DEMO_BASE_URL = "https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run";

type IconProps = {
  className?: string;
};

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isTestingEndpoint(url: string) {
  return url.replace(/\/+$/, "") === DEMO_BASE_URL;
}

function writeClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function maskToken(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}${"•".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
}

function SvgIcon({
  className,
  children,
  viewBox = "0 0 24 24",
  fill = "none",
}: React.PropsWithChildren<IconProps & { viewBox?: string; fill?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ArrowLeft({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </SvgIcon>
  );
}

function CheckCircle({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}

function ChevronDown({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

function Copy({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </SvgIcon>
  );
}

function CornerUpLeft({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </SvgIcon>
  );
}

function Eye({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </SvgIcon>
  );
}

function EyeOff({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 13.4 13.5" />
      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-4 4.8" />
      <path d="M6.6 6.7C4 8.3 2 12 2 12a17.7 17.7 0 0 0 10 7c1.7 0 3.3-.4 4.8-1.1" />
    </SvgIcon>
  );
}

function HatGlasses({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 10h20" />
      <path d="M5 10v2a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-2" />
      <path d="M12 10v2a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </SvgIcon>
  );
}

function Home({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </SvgIcon>
  );
}

function Loader2({ className }: IconProps) {
  return (
    <SvgIcon className={cn("animate-spin", className)}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    </SvgIcon>
  );
}

function Scale({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 3v18" />
      <path d="M6 6h12" />
      <path d="m6 6-3 6h6Z" />
      <path d="m18 6-3 6h6Z" />
      <path d="M9 21h6" />
    </SvgIcon>
  );
}

function Trash2({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7 7 19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </SvgIcon>
  );
}

function XCircle({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </SvgIcon>
  );
}

function buttonClass({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none",
    variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "outline" &&
      "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
    variant === "ghost" && "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
    size === "default" && "h-9 px-4 py-2 text-sm",
    size === "sm" && "h-8 gap-1.5 px-3 text-xs",
    size === "icon" && "size-9",
    size === "icon-sm" && "size-8",
    className,
  );
}

function inputClass(className?: string) {
  return cn(
    "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    className,
  );
}

export function BrowserExtensionConfigView({
  config,
  copy,
  pageLabel,
  onBack,
  onSave,
}: ExtensionSidepanelConfigViewProps) {
  const extensionApiKey = useBrowserChatPaneStore((state) => state.extensionApiKey);
  const extensionBaseUrl = useBrowserChatPaneStore((state) => state.extensionBaseUrl);
  const extensionModel = useBrowserChatPaneStore((state) => state.extensionModel);
  const extensionMaxSteps = useBrowserChatPaneStore((state) => state.extensionMaxSteps);
  const extensionSystemInstruction = useBrowserChatPaneStore((state) => state.extensionSystemInstruction);
  const extensionExperimentalLlmsTxt = useBrowserChatPaneStore(
    (state) => state.extensionExperimentalLlmsTxt,
  );
  const browserBridgeToken = useBrowserChatPaneStore((state) => state.browserBridgeToken);

  const [apiKey, setApiKey] = useState(extensionApiKey);
  const [baseURL, setBaseURL] = useState(extensionBaseUrl);
  const [model, setModel] = useState(extensionModel);
  const [language, setLanguage] = useState(config.language === "system" ? "" : config.language);
  const [permissionMode, setPermissionMode] = useState(config.permissionMode);
  const [maxSteps, setMaxSteps] = useState<number | "">(extensionMaxSteps ?? "");
  const [systemInstruction, setSystemInstruction] = useState(extensionSystemInstruction);
  const [experimentalLlmsTxt, setExperimentalLlmsTxt] = useState(extensionExperimentalLlmsTxt);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setApiKey(extensionApiKey);
    setBaseURL(extensionBaseUrl);
    setModel(extensionModel);
    setLanguage(config.language === "system" ? "" : config.language);
    setPermissionMode(config.permissionMode);
    setMaxSteps(extensionMaxSteps ?? "");
    setSystemInstruction(extensionSystemInstruction);
    setExperimentalLlmsTxt(extensionExperimentalLlmsTxt);
  }, [
    config.language,
    config.permissionMode,
    extensionApiKey,
    extensionBaseUrl,
    extensionExperimentalLlmsTxt,
    extensionMaxSteps,
    extensionModel,
    extensionSystemInstruction,
  ]);

  async function handleSave() {
    setSaving(true);

    try {
      await Promise.resolve(
        onSave({
          permissionMode,
          language: language || "system",
          apiKey,
          baseURL,
          model,
          maxSteps: maxSteps === "" ? null : maxSteps,
          systemInstruction: systemInstruction.length > 0 ? systemInstruction : null,
          experimentalLlmsTxt,
        }),
      );

      onBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="relative flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-balance">Settings</h2>
          <button
            type="button"
            aria-label="Back to chat"
            onClick={onBack}
            className={buttonClass({
              variant: "ghost",
              size: "icon-sm",
              className: "absolute right-3 top-2 cursor-pointer",
            })}
          >
            <CornerUpLeft className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 rounded-md border bg-muted/50 p-3">
          <label className="text-xs font-medium text-muted-foreground">User Auth Token</label>
          <p className="text-[10px] text-muted-foreground">
            Give a website the ability to call this extension.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={showToken ? browserBridgeToken : maskToken(browserBridgeToken)}
              className={inputClass("h-8 bg-background font-mono text-xs")}
            />
            <button
              type="button"
              aria-label={showToken ? "Hide token" : "Show token"}
              className={buttonClass({
                variant: "outline",
                size: "icon-sm",
                className: "h-8 w-8 shrink-0 cursor-pointer",
              })}
              onClick={() => setShowToken((value) => !value)}
            >
              {showToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
            <button
              type="button"
              aria-label="Copy token"
              className={buttonClass({
                variant: "outline",
                size: "icon-sm",
                className: "h-8 w-8 shrink-0 cursor-pointer",
              })}
              onClick={() => {
                writeClipboard(browserBridgeToken);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <span className="text-xs">✓</span> : <Copy className="size-3" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Base URL</label>
          <input
            placeholder="https://api.openai.com/v1"
            value={baseURL}
            onChange={(event) => setBaseURL(event.target.value)}
            className={inputClass("h-8 text-xs")}
          />
        </div>

        {isTestingEndpoint(baseURL) && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-muted-foreground text-pretty">
            <Scale className="mr-1 inline-block size-3 -translate-y-px text-amber-600" />
            You are using the free testing API. By using this service you agree to the{" "}
            <a
              href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Terms of Use & Privacy Policy
            </a>
            . No sensitive data. No guaranteed availability.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Model</label>
          <input
            placeholder="gpt-5.2"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className={inputClass("h-8 text-xs")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">API Key</label>
          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              placeholder="sk-..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className={inputClass("h-8 text-xs")}
            />
            <button
              type="button"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              className={buttonClass({
                variant: "outline",
                size: "icon-sm",
                className: "h-8 w-8 shrink-0 cursor-pointer",
              })}
              onClick={() => setShowApiKey((value) => !value)}
            >
              {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Language</label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={inputClass("h-8 cursor-pointer px-2 text-xs")}
          >
            <option value="">System</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Permission Mode</label>
          <select
            value={permissionMode}
            onChange={(event) => setPermissionMode(event.target.value as "ask" | "act")}
            className={inputClass("h-8 cursor-pointer px-2 text-xs")}
          >
            <option value="ask">Ask before acting</option>
            <option value="act">Direct action mode</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="mt-1 flex cursor-pointer items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          Advanced
          <ChevronDown
            className="size-3 transition-transform"
            style={{ transform: advancedOpen ? "rotate(0deg)" : "rotate(90deg)" }}
          />
        </button>

        {advancedOpen && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Max Steps</label>
              <input
                type="number"
                min={1}
                max={200}
                placeholder="40"
                value={maxSteps}
                onChange={(event) =>
                  setMaxSteps(event.target.value ? Number(event.target.value) : "")
                }
                className={inputClass(
                  "h-8 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">System Instruction</label>
              <textarea
                rows={3}
                value={systemInstruction}
                placeholder="Additional instructions for the agent..."
                onChange={(event) => setSystemInstruction(event.target.value)}
                className={cn(
                  inputClass("min-h-[60px] resize-y px-3 py-2 text-xs"),
                  "h-auto",
                )}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs text-muted-foreground">Experimental llms.txt support</span>
              <button
                type="button"
                role="switch"
                aria-checked={experimentalLlmsTxt}
                aria-label="Toggle experimental llms.txt support"
                onClick={() => setExperimentalLlmsTxt((value) => !value)}
                className={cn(
                  "inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none",
                  experimentalLlmsTxt ? "bg-primary" : "bg-input dark:bg-input/80",
                )}
              >
                <span
                  className={cn(
                    "block size-4 rounded-full bg-background transition-transform dark:data-[state=unchecked]:bg-foreground",
                    experimentalLlmsTxt ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
                  )}
                />
              </button>
            </label>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">{copy.contextLabel}</label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground text-pretty">
            {pageLabel}
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className={buttonClass({
              variant: "outline",
              className: "h-8 flex-1 cursor-pointer text-xs",
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className={buttonClass({
              variant: "default",
              className: "h-8 flex-1 cursor-pointer text-xs",
            })}
          >
            {saving ? <Loader2 className="size-3" /> : "Save"}
          </button>
        </div>

        <div className="mt-4 flex justify-between gap-2 border-t border-border/50 pt-4 text-[10px] text-muted-foreground">
          <div className="flex flex-col justify-between gap-1">
            <span>
              Runtime <span className="font-mono">{config.runtimeLabel}</span>
            </span>
            <a
              href="https://github.com/alibaba/page-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <svg role="img" viewBox="0 0 24 24" className="size-3 fill-current">
                <path d={GITHUB_ICON_PATH} />
              </svg>
              <span>Source Code</span>
            </a>
          </div>

          <div className="flex flex-col items-end gap-1">
            <a
              href="https://alibaba.github.io/page-agent/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Home className="size-3" />
              <span>Home Page</span>
            </a>
            <a
              href="https://github.com/alibaba/page-agent/blob/main/docs/terms-and-privacy.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <HatGlasses className="size-3" />
              <span>Privacy</span>
            </a>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 text-center text-[10px] text-muted-foreground">
          Built with ♥ by{" "}
          <a
            href="https://github.com/gaomeng1900"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            @Simon
          </a>
        </div>
      </div>
    </div>
  );
}

export function BrowserExtensionHistoryListView({
  sessions,
  onSelect,
  onBack,
  onDeleteSession,
  onClearSessions,
}: ExtensionSidepanelHistoryListViewProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          aria-label="Back to chat"
          onClick={onBack}
          className={buttonClass({ variant: "ghost", size: "icon-sm", className: "cursor-pointer" })}
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="flex-1 text-sm font-medium">History</span>
        {sessions.length > 0 && onClearSessions && (
          <button
            type="button"
            onClick={() => {
              void onClearSessions();
            }}
            className={buttonClass({
              variant: "ghost",
              size: "sm",
              className: "h-6 cursor-pointer px-2 text-[10px] text-muted-foreground hover:text-destructive",
            })}
          >
            <Trash2 className="mr-1 size-3" />
            Clear All
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No history yet
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(session.id)}
              onKeyDown={(event) => event.key === "Enter" && onSelect(session.id)}
              className="group flex w-full cursor-pointer items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              {session.status === "completed" ? (
                <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-green-500" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{session.task}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {timeAgo(session.createdAt)} · {session.history.length} steps
                </p>
              </div>

              {onDeleteSession && (
                <button
                  type="button"
                  aria-label={`Delete history entry ${session.task}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDeleteSession(session.id);
                  }}
                  className="shrink-0 cursor-pointer p-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function BrowserExtensionHistoryDetailView({
  session,
  onBack,
}: ExtensionSidepanelHistoryDetailViewProps) {
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          aria-label="Back to history"
          onClick={onBack}
          className={buttonClass({ variant: "ghost", size: "icon-sm", className: "cursor-pointer" })}
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="truncate text-sm font-medium">History</span>
      </header>

      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="text-[10px] uppercase text-muted-foreground">Task</div>
        <div className="text-xs font-medium" title={session.task}>
          {session.task}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {session.history.map((event, index) => (
          <EventCard key={`${session.id}-${index}`} event={event} />
        ))}
      </div>
    </div>
  );
}
