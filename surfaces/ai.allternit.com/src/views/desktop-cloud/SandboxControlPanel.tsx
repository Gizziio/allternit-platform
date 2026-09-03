"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  downloadDesktopFile,
  getDesktopScreenshot,
  runDesktopShell,
  sendDesktopKeyboard,
  sendDesktopMouse,
  uploadDesktopFile,
  type MouseInput,
  type KeyboardInput,
} from "@/lib/desktop-cloud-api";
import { Button } from "@/components/ui/button";

type MouseAction = MouseInput["action"];
type KeyboardAction = KeyboardInput["action"];
import { GlassSurface } from "@/design/GlassSurface";
import {
  Camera,
  Terminal,
  Mouse,
  Keyboard,
  Files,
  X,
  Spinner,
  Download,
  Upload,
} from "@phosphor-icons/react";

type TabId = "screenshot" | "shell" | "mouse" | "keyboard" | "files";

interface SandboxControlPanelProps {
  botId: string;
  sandboxId: string;
  os: string;
  onClose: () => void;
}

interface LoadingState {
  screenshot: boolean;
  shell: boolean;
  mouse: boolean;
  keyboard: boolean;
  upload: boolean;
  download: boolean;
}

export function SandboxControlPanel({ botId, sandboxId, os, onClose }: SandboxControlPanelProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<TabId>("screenshot");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({
    screenshot: false,
    shell: false,
    mouse: false,
    keyboard: false,
    upload: false,
    download: false,
  });

  // Screenshot
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Shell
  const [shellCommand, setShellCommand] = useState<string>("uname -a");
  const [shellOutput, setShellOutput] = useState<string>("");

  // Mouse
  const [mouseAction, setMouseAction] = useState<MouseAction>("move");
  const [mouseX, setMouseX] = useState<number>(100);
  const [mouseY, setMouseY] = useState<number>(100);
  const [mouseButton, setMouseButton] = useState<"left" | "middle" | "right">("left");

  // Keyboard
  const [keyboardAction, setKeyboardAction] = useState<KeyboardAction>("type");
  const [keyboardInput, setKeyboardInput] = useState<string>("hello");

  // Files
  const [filePath, setFilePath] = useState<string>("/tmp/test.txt");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setTabError = useCallback((message: string | null) => {
    setError(message);
  }, []);

  const withLoading = useCallback(
    async <K extends keyof LoadingState>(key: K, fn: () => Promise<void>) => {
      setLoading((prev) => ({ ...prev, [key]: true }));
      setTabError(null);
      try {
        await fn();
      } catch (err) {
        setTabError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [setTabError]
  );

  const handleScreenshot = async () => {
    await withLoading("screenshot", async () => {
      const blob = await getDesktopScreenshot(botId, sandboxId);
      const url = URL.createObjectURL(blob);
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(url);
    });
  };

  const handleShell = async () => {
    await withLoading("shell", async () => {
      const parts = shellCommand.trim().split(/\s+/);
      const result = await runDesktopShell(botId, sandboxId, parts);
      setShellOutput(
        `Exit code: ${result.exit_code}\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`
      );
    });
  };

  const handleMouse = async () => {
    await withLoading("mouse", async () => {
      const input: MouseInput = {
        action: mouseAction,
        x: mouseX,
        y: mouseY,
        button: mouseButton,
      };
      await sendDesktopMouse(botId, sandboxId, input);
    });
  };

  const handleKeyboard = async () => {
    await withLoading("keyboard", async () => {
      const input: KeyboardInput =
        keyboardAction === "type"
          ? { action: "type", text: keyboardInput }
          : { action: "key", key: keyboardInput };
      await sendDesktopKeyboard(botId, sandboxId, input);
    });
  };

  const handleDownload = async () => {
    await withLoading("download", async () => {
      const blob = await downloadDesktopFile(botId, sandboxId, filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filePath.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await withLoading("upload", async () => {
      const base64 = await fileToBase64(selectedFile);
      await uploadDesktopFile(botId, sandboxId, filePath, base64);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "screenshot", label: "Screenshot", icon: <Camera size={16} /> },
    { id: "shell", label: "Shell", icon: <Terminal size={16} /> },
    { id: "mouse", label: "Mouse", icon: <Mouse size={16} /> },
    { id: "keyboard", label: "Keyboard", icon: <Keyboard size={16} /> },
    { id: "files", label: "Files", icon: <Files size={16} /> },
  ];

  return (
    <GlassSurface intensity="base" className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          Control sandbox <span className="font-mono text-xs text-[var(--ui-text-muted)]">{sandboxId}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {activeTab === "screenshot" && (
        <div className="space-y-3">
          <Button size="sm" onClick={handleScreenshot} disabled={loading.screenshot}>
            {loading.screenshot ? <Spinner size={14} className="animate-spin" /> : <Camera size={14} />}
            Capture
          </Button>
          {screenshotUrl && (
            <img
              src={screenshotUrl}
              alt="Desktop screenshot"
              className="max-h-96 rounded-lg border border-[var(--border-subtle)]"
            />
          )}
        </div>
      )}

      {activeTab === "shell" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={shellCommand}
              onChange={(e) => setShellCommand(e.target.value)}
              placeholder="Command (space-separated args)"
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              onKeyDown={(e) => e.key === "Enter" && handleShell()}
            />
            <Button size="sm" onClick={handleShell} disabled={loading.shell}>
              {loading.shell ? <Spinner size={14} className="animate-spin" /> : <Terminal size={14} />}
              Run
            </Button>
          </div>
          {shellOutput && (
            <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-black/40 p-3 font-mono text-xs">
              {shellOutput}
            </pre>
          )}
        </div>
      )}

      {activeTab === "mouse" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-[var(--ui-text-muted)]">Action</label>
            <select
              value={mouseAction}
              onChange={(e) => setMouseAction(e.target.value as MouseAction)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-sm"
            >
              <option value="move">move</option>
              <option value="click">click</option>
              <option value="rightclick">rightclick</option>
              <option value="doubleclick">doubleclick</option>
              <option value="mousedown">mousedown</option>
              <option value="mouseup">mouseup</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ui-text-muted)]">X</label>
            <input
              type="number"
              value={mouseX}
              onChange={(e) => setMouseX(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ui-text-muted)]">Y</label>
            <input
              type="number"
              value={mouseY}
              onChange={(e) => setMouseY(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--ui-text-muted)]">Button</label>
            <select
              value={mouseButton}
              onChange={(e) => setMouseButton(e.target.value as "left" | "middle" | "right")}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-sm"
            >
              <option value="left">left</option>
              <option value="middle">middle</option>
              <option value="right">right</option>
            </select>
          </div>
          <div className="col-span-full">
            <Button size="sm" onClick={handleMouse} disabled={loading.mouse}>
              {loading.mouse ? <Spinner size={14} className="animate-spin" /> : <Mouse size={14} />}
              Send mouse action
            </Button>
          </div>
        </div>
      )}

      {activeTab === "keyboard" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={keyboardAction}
              onChange={(e) => setKeyboardAction(e.target.value as KeyboardAction)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-2 text-sm"
            >
              <option value="type">type</option>
              <option value="key">key</option>
            </select>
            <input
              type="text"
              value={keyboardInput}
              onChange={(e) => setKeyboardInput(e.target.value)}
              placeholder={keyboardAction === "type" ? "Text to type" : "Key name (e.g. Return)"}
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              onKeyDown={(e) => e.key === "Enter" && handleKeyboard()}
            />
            <Button size="sm" onClick={handleKeyboard} disabled={loading.keyboard}>
              {loading.keyboard ? <Spinner size={14} className="animate-spin" /> : <Keyboard size={14} />}
              Send
            </Button>
          </div>
        </div>
      )}

      {activeTab === "files" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--ui-text-muted)]">Upload file</div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <Button size="sm" onClick={handleUpload} disabled={!selectedFile || loading.upload}>
                {loading.upload ? <Spinner size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload to {filePath || "path"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--ui-text-muted)]">Download file</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/path/to/file"
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
              />
              <Button size="sm" onClick={handleDownload} disabled={loading.download}>
                {loading.download ? <Spinner size={14} className="animate-spin" /> : <Download size={14} />}
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </GlassSurface>
  );
}
