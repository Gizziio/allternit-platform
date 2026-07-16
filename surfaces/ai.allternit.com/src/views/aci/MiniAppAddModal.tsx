"use client";

import React, { useState } from "react";
import { GithubLogo, Globe, Plus, Wrench } from "@phosphor-icons/react";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/Modal";
import type {
  InstalledMiniApp,
  MiniAppManifest,
  MiniAppPresentationMode,
} from "./mini-app.types";
import { manifestToMiniApp } from "./mini-app-registry";
import { validateMiniAppManifest } from "./mini-app-manifest";

type AddMode = "choose" | "github" | "url" | "create";

export function MiniAppAddModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (app: InstalledMiniApp) => void;
}) {
  const [mode, setMode] = useState<AddMode>("choose");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [presentationMode, setPresentationMode] =
    useState<MiniAppPresentationMode>("hybrid");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setMode("choose");
    setValue("");
    setName("");
    setDescription("");
    setError("");
    setWorking(false);
    onClose();
  };

  const add = (app: InstalledMiniApp) => {
    onAdd(app);
    close();
  };

  const importUrl = async () => {
    setWorking(true);
    setError("");
    try {
      const url = new URL(value.trim());
      const manifestUrl = url.pathname.endsWith(".json")
        ? url.toString()
        : `${url.origin}/.well-known/allternit-app.json`;
      let manifest: MiniAppManifest | null = null;
      try {
        const response = await fetch(manifestUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const candidate = validateMiniAppManifest(await response.json());
          if (candidate.valid) manifest = candidate.manifest;
        }
      } catch {
        /* A normal website can still be added as an embedded miniapp. */
      }
      if (manifest) {
        add({
          ...manifestToMiniApp(manifest, url.origin, "url"),
          status: "pinned",
          installState: "installed",
          runtimeState: "unknown",
          isPinned: true,
          catalogSource: "url",
        });
        return;
      }
      add({
        id: `url:${url.hostname}:${Date.now()}`,
        name: name.trim() || url.hostname,
        description:
          description.trim() || `Miniapp added from ${url.hostname}.`,
        category: "custom",
        source: "url",
        url: url.toString(),
        sourceUrl: url.toString(),
        status: "pinned",
        installState: "installed",
        runtimeState: "unknown",
        isPinned: true,
        catalogSource: "url",
        presentation: {
          mode: "embedded",
          uiUrl: url.toString(),
          fallback: "external-browser",
          electronPartition: `persist:allternit-${url.hostname.replace(/[^a-z0-9-]/gi, "-")}`,
        },
      });
    } catch {
      setError("Enter a valid http or https URL.");
      setWorking(false);
    }
  };

  const importGithub = async () => {
    setWorking(true);
    setError("");
    const match = value
      .trim()
      .match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (!match) {
      setError("Use owner/repository or a GitHub repository URL.");
      setWorking(false);
      return;
    }
    const repo = `${match[1]}/${match[2]}`;
    const candidates = [
      `https://raw.githubusercontent.com/${repo}/HEAD/.allternit/miniapp.json`,
      `https://raw.githubusercontent.com/${repo}/HEAD/.well-known/allternit-app.json`,
    ];
    for (const manifestUrl of candidates) {
      try {
        const response = await fetch(manifestUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) continue;
        const candidate = validateMiniAppManifest(await response.json());
        if (!candidate.valid) continue;
        const manifest = candidate.manifest;
        add({
          ...manifestToMiniApp(
            manifest,
            `https://github.com/${repo}`,
            "github",
          ),
          repo,
          githubUrl: `https://github.com/${repo}`,
          status: "pinned",
          installState: "installed",
          runtimeState: "unknown",
          isPinned: true,
          catalogSource: "github",
        });
        return;
      } catch {
        /* Try the next conventional manifest location. */
      }
    }
    add({
      id: `github:${repo.toLowerCase()}`,
      name: name.trim() || match[2],
      description:
        description.trim() ||
        `Community project imported from ${repo}. Review and complete its runtime configuration before launching.`,
      category: "custom",
      source: "github",
      url: `https://github.com/${repo}`,
      sourceUrl: `https://github.com/${repo}`,
      repo,
      githubUrl: `https://github.com/${repo}`,
      status: "pinned",
      installState: "repair-needed",
      runtimeState: "unknown",
      isPinned: true,
      catalogSource: "github",
      catalogOnly: true,
      presentation: { mode: "native", fallback: "native-tools" },
      capabilities: ["Repository imported", "Runtime setup required"],
    });
  };

  const create = () => {
    if (!name.trim()) {
      setError("Give the miniapp a name.");
      return;
    }
    if (presentationMode !== "native") {
      try {
        new URL(value.trim());
      } catch {
        setError("Embedded and hybrid miniapps need a valid UI URL.");
        return;
      }
    }
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    add({
      id: `local:${slug}:${Date.now()}`,
      name: name.trim(),
      description: description.trim() || "User-created Allternit miniapp.",
      category: "custom",
      source: "local",
      url: value.trim(),
      sourceUrl: value.trim() || undefined,
      status: "pinned",
      installState: "installed",
      runtimeState: "unknown",
      isPinned: true,
      catalogSource: "local",
      presentation: {
        mode: presentationMode,
        uiUrl: presentationMode === "native" ? undefined : value.trim(),
        fallback:
          presentationMode === "native" ? "native-tools" : "external-browser",
        electronPartition: `persist:allternit-${slug}`,
      },
      capabilities:
        presentationMode === "native"
          ? ["User-defined native miniapp"]
          : ["User-defined web interface"],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="medium">
      <ModalHeader
        title={
          mode === "choose"
            ? "Add a miniapp"
            : mode === "github"
              ? "Import from GitHub"
              : mode === "url"
                ? "Add by URL"
                : "Create miniapp"
        }
        onClose={close}
      />
      <ModalBody>
        {mode === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice
              icon={<GithubLogo size={22} />}
              title="GitHub"
              detail="Import a manifest or create a draft."
              onClick={() => setMode("github")}
            />
            <Choice
              icon={<Globe size={22} />}
              title="URL"
              detail="Connect a hosted app or manifest."
              onClick={() => setMode("url")}
            />
            <Choice
              icon={<Wrench size={22} />}
              title="Create"
              detail="Build your own miniapp definition."
              onClick={() => setMode("create")}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {mode === "github" && (
              <Field
                label="Repository"
                value={value}
                onChange={setValue}
                placeholder="owner/repository"
              />
            )}
            {mode === "url" && (
              <Field
                label="App or manifest URL"
                value={value}
                onChange={setValue}
                placeholder="https://app.example.com"
              />
            )}
            {mode === "create" && (
              <>
                <Field
                  label="Name"
                  value={name}
                  onChange={setName}
                  placeholder="My miniapp"
                />
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Experience
                  <select
                    value={presentationMode}
                    onChange={(event) =>
                      setPresentationMode(
                        event.target.value as MiniAppPresentationMode,
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm"
                  >
                    <option value="native">Native</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="embedded">Embedded</option>
                  </select>
                </label>
                {presentationMode !== "native" && (
                  <Field
                    label="UI URL"
                    value={value}
                    onChange={setValue}
                    placeholder="http://localhost:3000"
                  />
                )}
              </>
            )}
            {(mode === "github" || mode === "url") && (
              <Field
                label="Display name (optional)"
                value={name}
                onChange={setName}
                placeholder="Detected automatically when possible"
              />
            )}
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 text-sm"
              />
            </label>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </ModalBody>
      {mode !== "choose" && (
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              setMode("choose");
              setError("");
            }}
            className="h-9 rounded-lg border border-[var(--border-default)] px-4 text-sm"
          >
            Back
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() =>
              void (mode === "github"
                ? importGithub()
                : mode === "url"
                  ? importUrl()
                  : create())
            }
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm text-[var(--bg-elevated)] disabled:opacity-50"
          >
            <Plus size={14} />
            {working ? "Checking…" : "Add miniapp"}
          </button>
        </ModalFooter>
      )}
    </Modal>
  );
}

function Choice({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[var(--border-subtle)] p-4 text-left hover:border-[var(--border-hover)]"
    >
      <span className="text-[var(--accent-primary)]">{icon}</span>
      <span className="mt-3 block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
        {detail}
      </span>
    </button>
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
