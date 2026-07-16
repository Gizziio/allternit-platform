"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  CircleNotch,
  Flask,
  Warning,
} from "@phosphor-icons/react";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/Modal";
import type {
  InstalledMiniApp,
  MiniAppPresentationMode,
} from "./mini-app.types";
import { resolveMiniAppPresentation } from "./mini-app-presentation";

type TestState = "idle" | "testing" | "passed" | "failed";

export function MiniAppConfigureModal({
  app,
  isOpen,
  onClose,
  onSave,
}: {
  app: InstalledMiniApp;
  isOpen: boolean;
  onClose: () => void;
  onSave: (app: InstalledMiniApp) => void;
}) {
  const currentPresentation = resolveMiniAppPresentation(app);
  const [mode, setMode] = useState<MiniAppPresentationMode>(
    currentPresentation.mode,
  );
  const [uiUrl, setUiUrl] = useState(currentPresentation.uiUrl || "");
  const [healthUrl, setHealthUrl] = useState(
    currentPresentation.healthUrl || "",
  );
  const [transport, setTransport] = useState(app.harness?.transport || "http");
  const [baseURL, setBaseURL] = useState(app.harness?.baseURL || "");
  const [installCommand, setInstallCommand] = useState(
    app.lifecycle?.install?.command || "",
  );
  const [startCommand, setStartCommand] = useState(
    app.lifecycle?.start?.command || "",
  );
  const [stopCommand, setStopCommand] = useState(
    app.lifecycle?.stop?.command || "",
  );
  const [network, setNetwork] = useState(
    (app.permissions?.network || []).join(", "),
  );
  const [filesystem, setFilesystem] = useState(
    (app.permissions?.filesystem || []).join(", "),
  );
  const [secrets, setSecrets] = useState(
    (app.permissions?.secrets || []).join(", "),
  );
  const [processes, setProcesses] = useState(
    app.permissions?.processes || false,
  );
  const [testState, setTestState] = useState<TestState>("idle");
  const [error, setError] = useState("");

  const split = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const validate = (): boolean => {
    if (mode !== "native" && !uiUrl.trim()) {
      setError("Hybrid and embedded miniapps need a UI URL.");
      return false;
    }
    for (const candidate of [uiUrl, healthUrl, baseURL].filter(Boolean)) {
      try {
        new URL(candidate);
      } catch {
        setError(`Invalid URL: ${candidate}`);
        return false;
      }
    }
    setError("");
    return true;
  };

  const test = async () => {
    if (!validate()) return;
    const endpoint = healthUrl.trim() || uiUrl.trim() || baseURL.trim();
    if (!endpoint) {
      setTestState(mode === "native" ? "passed" : "failed");
      return;
    }
    setTestState("testing");
    try {
      await fetch(endpoint, {
        mode: "no-cors",
        signal: AbortSignal.timeout(5000),
      });
      setTestState("passed");
    } catch {
      setTestState("failed");
    }
  };

  const save = () => {
    if (!validate()) return;
    const configured: InstalledMiniApp = {
      ...app,
      url: uiUrl.trim() || app.url,
      catalogOnly: false,
      requiresRuntimeApproval: Boolean(
        installCommand.trim() || startCommand.trim() || stopCommand.trim(),
      ),
      installState: installCommand.trim() ? "not-installed" : "installed",
      runtimeState: "unknown",
      presentation: {
        mode,
        uiUrl: mode === "native" ? undefined : uiUrl.trim(),
        healthUrl: healthUrl.trim() || undefined,
        nativeRenderer:
          mode === "native" ? currentPresentation.nativeRenderer : undefined,
        electronPartition:
          currentPresentation.electronPartition ||
          `persist:allternit-${app.id.replace(/[^a-z0-9-]/gi, "-")}`,
        fallback: mode === "native" ? "native-tools" : "external-browser",
      },
      harness: {
        ...app.harness,
        transport,
        baseURL: baseURL.trim() || undefined,
      },
      lifecycle: {
        install: installCommand.trim()
          ? { command: installCommand.trim() }
          : undefined,
        start: startCommand.trim()
          ? { command: startCommand.trim() }
          : undefined,
        stop: stopCommand.trim()
          ? { method: "command", command: stopCommand.trim() }
          : undefined,
        health: healthUrl.trim()
          ? { kind: "http", url: healthUrl.trim() }
          : undefined,
      },
      permissions: {
        network: split(network),
        filesystem: split(filesystem),
        secrets: split(secrets),
        processes,
      },
    };
    onSave(configured);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title={`Configure ${app.name}`} onClose={onClose} />
      <ModalBody className="space-y-6">
        <Section
          title="Presentation"
          description="Choose how this miniapp appears inside Allternit."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Experience"
              value={mode}
              onChange={(value) => setMode(value as MiniAppPresentationMode)}
              options={["native", "hybrid", "embedded"]}
            />
            {mode !== "native" && (
              <Field
                label="UI URL"
                value={uiUrl}
                onChange={setUiUrl}
                placeholder="http://localhost:3000"
              />
            )}
          </div>
        </Section>
        <Section
          title="Runtime"
          description="Commands are stored for desktop review and are not executed from this form."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Transport"
              value={transport}
              onChange={(value) =>
                setTransport(
                  value as NonNullable<
                    InstalledMiniApp["harness"]
                  >["transport"],
                )
              }
              options={["http", "mcp", "rpc", "acp", "subprocess"]}
            />
            <Field
              label="API or transport URL"
              value={baseURL}
              onChange={setBaseURL}
              placeholder="http://localhost:3000/api"
            />
            <Field
              label="Install command"
              value={installCommand}
              onChange={setInstallCommand}
              placeholder="npm install"
            />
            <Field
              label="Start command"
              value={startCommand}
              onChange={setStartCommand}
              placeholder="npm start"
            />
            <Field
              label="Stop command"
              value={stopCommand}
              onChange={setStopCommand}
              placeholder="optional"
            />
            <Field
              label="Health endpoint"
              value={healthUrl}
              onChange={setHealthUrl}
              placeholder="http://localhost:3000/health"
            />
          </div>
        </Section>
        <Section
          title="Permissions"
          description="Declare access before the miniapp can be verified or shared."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Network hosts"
              value={network}
              onChange={setNetwork}
              placeholder="api.example.com, localhost:3000"
            />
            <Field
              label="Filesystem paths"
              value={filesystem}
              onChange={setFilesystem}
              placeholder="~/Documents/project"
            />
            <Field
              label="Secrets"
              value={secrets}
              onChange={setSecrets}
              placeholder="OPENAI_API_KEY"
            />
            <label className="flex items-center gap-2 self-end rounded-lg border border-[var(--border-default)] px-3 py-2.5 text-xs">
              <input
                type="checkbox"
                checked={processes}
                onChange={(event) => setProcesses(event.target.checked)}
              />
              May launch local processes
            </label>
          </div>
        </Section>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {testState === "passed" && (
          <p className="flex items-center gap-2 text-xs text-green-500">
            <CheckCircle size={15} />
            Endpoint is reachable.
          </p>
        )}
        {testState === "failed" && (
          <p className="flex items-center gap-2 text-xs text-amber-500">
            <Warning size={15} />
            Endpoint is not reachable yet. You can still save the draft.
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={() => void test()}
          disabled={testState === "testing"}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 text-sm"
        >
          {testState === "testing" ? (
            <CircleNotch size={14} className="animate-spin" />
          ) : (
            <Flask size={14} />
          )}
          Test configuration
        </button>
        <button
          type="button"
          onClick={save}
          className="ml-auto h-9 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)]"
        >
          Save configuration
        </button>
      </ModalFooter>
    </Modal>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-3 mt-1 text-xs text-[var(--text-tertiary)]">
        {description}
      </p>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--text-secondary)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm"
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-xs font-medium text-[var(--text-secondary)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
