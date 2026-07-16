"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  DownloadSimple,
  Key,
  ShieldCheck,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/Modal";
import type { InstalledMiniApp, MiniAppManifest } from "./mini-app.types";
import {
  hasLintErrors,
  lintMiniAppManifest,
  type MiniAppLintFinding,
} from "./mini-app-lint";
import { explainMiniAppPermissions } from "./mini-app-permissions-explain";
import {
  generateSigningKey,
  importSigningKey,
  isManifestSigningAvailable,
  signManifest,
} from "./mini-app-signing";
import { verifyMiniAppManifestSignature } from "./mini-app-manifest";
import { resolveRegistryBase } from "./use-mini-app-review";

const TOKEN_STORAGE_KEY = "allternit.miniapp-publisher.token";

/** Intake pipeline stages, in execution order. */
const PIPELINE_STAGES = [
  "schema_validation",
  "signature_validation",
  "repo_check",
  "license_check",
  "secret_scan",
  "dependency_scan",
  "malware_scan",
  "sbom",
  "install_test",
  "health_test",
  "ui_test",
] as const;

const MAX_SCREENSHOTS = 5;
const ICON_MIMES = new Set(["image/png", "image/svg+xml", "image/webp"]);
const SCREENSHOT_MIMES = new Set(["image/png", "image/webp", "image/jpeg"]);
const ICON_MAX_BYTES = 2 * 1024 * 1024;
const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;

interface PublisherKeyRow {
  id: number;
  publisherId: string;
  keyFingerprint: string;
  publicKey: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
}

interface VersionSummary {
  version: string;
  status: string;
  submittedAt: number;
  changelog: string | null;
  signed: boolean;
  assets: string[];
}

interface IntakeReport {
  stage: string | null;
  scanner: string;
  status: "pass" | "warn" | "fail";
  summary: unknown;
  createdAt: string;
}

interface IntakeStatus {
  job: { status: string; lastError: string | null; attempts: number } | null;
  reports: IntakeReport[];
}

interface AssetDraft {
  kind: "icon" | "screenshot";
  blob: Blob;
  previewUrl: string;
  mime: string;
  size: number;
  sha256: string;
  state: "pending" | "uploading" | "done" | "error";
  error?: string;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; created: boolean; version: string }
  | { kind: "error"; message: string };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Raster icons are square-cropped onto a 512×512 PNG canvas; SVG passes. */
async function prepareIconBlob(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this environment.");
    const scale = Math.max(512 / bitmap.width, 512 / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(
      bitmap,
      (512 - width) / 2,
      (512 - height) / 2,
      width,
      height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG encoding failed.")),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const payload = JSON.parse(text) as {
        error?: unknown;
        message?: unknown;
      };
      const detail =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : text;
      return `: ${detail}`;
    } catch {
      return `: ${text}`;
    }
  } catch {
    return "";
  }
}

function buildDraftManifest(
  app: InstalledMiniApp,
  version: string,
  changelog: string,
): MiniAppManifest {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    version: version.trim() || undefined,
    icon: app.icon,
    category: app.category,
    pinnable: true,
    repo: app.repo,
    githubUrl: app.githubUrl,
    downloadable: app.downloadable,
    presentation: app.presentation,
    harness: app.harness,
    lifecycle: app.lifecycle,
    permissions: app.permissions,
    compatibility: app.compatibility,
    release: { changelog: changelog.trim() || undefined },
    oauth: app.oauth,
  };
}

export function MiniAppPublishModal({
  app,
  isOpen,
  onClose,
}: {
  app: InstalledMiniApp;
  isOpen: boolean;
  onClose: () => void;
}) {
  const registryBase = resolveRegistryBase();
  const signingAvailable = isManifestSigningAvailable();

  const [token, setToken] = useState(
    () => storage()?.getItem(TOKEN_STORAGE_KEY) ?? "",
  );
  const [version, setVersion] = useState(app.version || "0.1.0");
  const [changelog, setChangelog] = useState(app.release?.changelog || "");

  const [signingKey, setSigningKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [keyNotice, setKeyNotice] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const [registeredKeys, setRegisteredKeys] = useState<PublisherKeyRow[]>([]);
  const [keysError, setKeysError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [revokingFingerprint, setRevokingFingerprint] = useState<string | null>(
    null,
  );
  const [revokeConfirmation, setRevokeConfirmation] = useState("");
  const [signedManifest, setSignedManifest] = useState<MiniAppManifest | null>(
    null,
  );
  const [signatureVerified, setSignatureVerified] = useState<boolean | null>(
    null,
  );
  const [signing, setSigning] = useState(false);

  const [iconAsset, setIconAsset] = useState<AssetDraft | null>(null);
  const [screenshots, setScreenshots] = useState<AssetDraft[]>([]);
  const [assetError, setAssetError] = useState("");
  const iconInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const [submittedVersion, setSubmittedVersion] = useState<string | null>(null);
  const [versionSummary, setVersionSummary] = useState<VersionSummary | null>(
    null,
  );
  const [intake, setIntake] = useState<IntakeStatus | null>(null);
  const [trackingError, setTrackingError] = useState("");

  // Reset the form when the dialog is reopened for (another) app.
  useEffect(() => {
    if (!isOpen) return;
    setVersion(app.version || "0.1.0");
    setChangelog(app.release?.changelog || "");
    setSignedManifest(null);
    setSignatureVerified(null);
    setSubmitState({ kind: "idle" });
    setSubmittedVersion(null);
    setVersionSummary(null);
    setIntake(null);
  }, [isOpen, app]);

  const draft = useMemo(
    () => buildDraftManifest(app, version, changelog),
    [app, version, changelog],
  );

  const findings = useMemo(
    () =>
      lintMiniAppManifest(signedManifest ?? draft, {
        signed: Boolean(signedManifest && signatureVerified),
      }),
    [draft, signedManifest, signatureVerified],
  );
  const lintBlocked = hasLintErrors(findings);

  const permissionExplanations = useMemo(
    () => explainMiniAppPermissions(app),
    [app],
  );

  // SHA-256 fingerprint of the base64 public key string, matching the
  // registry's key_fingerprint.
  useEffect(() => {
    if (!publicKey) {
      setFingerprint(null);
      return;
    }
    let cancelled = false;
    void sha256Hex(new TextEncoder().encode(publicKey)).then((hex) => {
      if (!cancelled) setFingerprint(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const persistToken = (value: string) => {
    setToken(value);
    const store = storage();
    if (value) store?.setItem(TOKEN_STORAGE_KEY, value);
    else store?.removeItem(TOKEN_STORAGE_KEY);
  };

  const refreshKeys = useCallback(async () => {
    if (!registryBase || !token) return;
    try {
      const response = await fetch(`${registryBase}/v1/publishers/keys`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setKeysError(
          response.status === 401
            ? "Publisher token rejected (401); the key list requires a valid token."
            : `Could not load registered keys (${response.status}).`,
        );
        return;
      }
      setRegisteredKeys((await response.json()) as PublisherKeyRow[]);
      setKeysError("");
    } catch {
      setKeysError("Registry unreachable.");
    }
  }, [registryBase, token]);

  useEffect(() => {
    if (isOpen && token && registryBase) void refreshKeys();
  }, [isOpen, token, registryBase, refreshKeys]);

  const onVersionChange = (value: string) => {
    setVersion(value);
    setSignedManifest(null);
    setSignatureVerified(null);
  };
  const onChangelogChange = (value: string) => {
    setChangelog(value);
    setSignedManifest(null);
    setSignatureVerified(null);
  };

  const downloadBackup = (backup: {
    publicKey: string;
    privateKeyPkcs8: string;
  }) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "allternit-publisher-key.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateKey = async () => {
    setKeyNotice(null);
    try {
      const generated = await generateSigningKey();
      const imported = await importSigningKey(generated.privateKeyPkcs8);
      setSigningKey(imported.key);
      setPublicKey(imported.publicKey);
      downloadBackup({
        publicKey: generated.publicKey,
        privateKeyPkcs8: generated.privateKeyPkcs8,
      });
      setKeyNotice({
        kind: "ok",
        text: "Key generated. A backup file was downloaded — keep it safe; the private key is never stored by Allternit.",
      });
    } catch (reason) {
      setKeyNotice({
        kind: "error",
        text:
          reason instanceof Error ? reason.message : "Key generation failed.",
      });
    }
  };

  const importKeyFromFile = async (file: File) => {
    setKeyNotice(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        publicKey?: unknown;
        privateKeyPkcs8?: unknown;
      };
      if (typeof parsed.privateKeyPkcs8 !== "string") {
        throw new Error("That file is not an Allternit publisher key backup.");
      }
      const imported = await importSigningKey(parsed.privateKeyPkcs8);
      if (
        typeof parsed.publicKey === "string" &&
        parsed.publicKey !== imported.publicKey
      ) {
        throw new Error(
          "The private key does not match the public key in that backup.",
        );
      }
      setSigningKey(imported.key);
      setPublicKey(imported.publicKey);
      setKeyNotice({ kind: "ok", text: "Publisher key imported." });
    } catch (reason) {
      setKeyNotice({
        kind: "error",
        text: reason instanceof Error ? reason.message : "Import failed.",
      });
    }
  };

  const registerKey = async () => {
    if (!registryBase || !token || !publicKey) return;
    setRegistering(true);
    setKeyNotice(null);
    try {
      const response = await fetch(`${registryBase}/v1/publishers/keys`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ publicKey }),
      });
      if (!response.ok) {
        const detail = await readErrorDetail(response);
        setKeyNotice({
          kind: "error",
          text:
            response.status === 401
              ? "Publisher token rejected (401); cannot register the key."
              : response.status === 409
                ? "This key was revoked and cannot be re-registered (409). Generate a new key."
                : `Key registration failed (${response.status})${detail}`,
        });
        return;
      }
      setKeyNotice({ kind: "ok", text: "Public key registered." });
      await refreshKeys();
    } catch {
      setKeyNotice({ kind: "error", text: "Registry unreachable." });
    } finally {
      setRegistering(false);
    }
  };

  const revokeKey = async (keyFingerprint: string) => {
    if (!registryBase || !token) return;
    try {
      const response = await fetch(
        `${registryBase}/v1/publishers/keys/${encodeURIComponent(keyFingerprint)}/revoke`,
        { method: "POST", headers: { authorization: `Bearer ${token}` } },
      );
      if (response.status !== 204) {
        setKeyNotice({
          kind: "error",
          text: `Revoke failed (${response.status}).`,
        });
        return;
      }
      setRevokingFingerprint(null);
      setRevokeConfirmation("");
      await refreshKeys();
    } catch {
      setKeyNotice({ kind: "error", text: "Registry unreachable." });
    }
  };

  const sign = async () => {
    if (!signingKey || !publicKey) return;
    setSigning(true);
    try {
      const signed = await signManifest(draft, signingKey, publicKey);
      const verified = await verifyMiniAppManifestSignature(signed);
      setSignedManifest(verified ? signed : null);
      setSignatureVerified(verified);
    } finally {
      setSigning(false);
    }
  };

  const pickIcon = async (file: File) => {
    setAssetError("");
    if (!ICON_MIMES.has(file.type)) {
      setAssetError("Icon must be a png, svg, or webp image.");
      return;
    }
    try {
      const blob = await prepareIconBlob(file);
      if (blob.size > ICON_MAX_BYTES) {
        setAssetError("Icon must be 2 MB or smaller after processing.");
        return;
      }
      const sha256 = await sha256Hex(await blob.arrayBuffer());
      if (iconAsset) URL.revokeObjectURL(iconAsset.previewUrl);
      setIconAsset({
        kind: "icon",
        blob,
        previewUrl: URL.createObjectURL(blob),
        mime: blob.type || file.type,
        size: blob.size,
        sha256,
        state: "pending",
      });
    } catch {
      setAssetError("Could not process that image file.");
    }
  };

  const pickScreenshots = async (files: FileList) => {
    setAssetError("");
    const room = MAX_SCREENSHOTS - screenshots.length;
    const selected = Array.from(files).slice(0, room);
    if (files.length > room) {
      setAssetError(`At most ${MAX_SCREENSHOTS} screenshots.`);
    }
    for (const file of selected) {
      if (!SCREENSHOT_MIMES.has(file.type)) {
        setAssetError("Screenshots must be png, webp, or jpeg images.");
        continue;
      }
      if (file.size > SCREENSHOT_MAX_BYTES) {
        setAssetError(`Screenshot ${file.name} is larger than 10 MB.`);
        continue;
      }
      const sha256 = await sha256Hex(await file.arrayBuffer());
      setScreenshots((current) => [
        ...current,
        {
          kind: "screenshot",
          blob: file,
          previewUrl: URL.createObjectURL(file),
          mime: file.type,
          size: file.size,
          sha256,
          state: "pending",
        },
      ]);
    }
  };

  const uploadAsset = useCallback(
    async (
      asset: AssetDraft,
      targetVersion: string,
      update: (patch: Partial<AssetDraft>) => void,
    ) => {
      if (!registryBase || !token) return;
      update({ state: "uploading", error: undefined });
      try {
        const grantResponse = await fetch(
          `${registryBase}/v1/miniapps/${encodeURIComponent(app.id)}/uploads`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              kind: asset.kind,
              sha256: asset.sha256,
              size: asset.size,
              mime: asset.mime,
              version: targetVersion,
            }),
          },
        );
        if (grantResponse.status !== 201) {
          const detail = await readErrorDetail(grantResponse);
          throw new Error(
            `upload grant failed (${grantResponse.status})${detail}`,
          );
        }
        const grant = (await grantResponse.json()) as {
          storageKey: string;
          uploadUrl: string;
          headers: Record<string, string>;
        };
        const put = await fetch(grant.uploadUrl, {
          method: "PUT",
          headers: grant.headers,
          body: asset.blob,
        });
        if (!put.ok) throw new Error(`storage upload failed (${put.status})`);
        const completeResponse = await fetch(
          `${registryBase}/v1/miniapps/${encodeURIComponent(app.id)}/uploads/complete`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              kind: asset.kind,
              sha256: asset.sha256,
              size: asset.size,
              mime: asset.mime,
              version: targetVersion,
              storageKey: grant.storageKey,
            }),
          },
        );
        if (completeResponse.status !== 201) {
          const detail = await readErrorDetail(completeResponse);
          throw new Error(
            `upload completion failed (${completeResponse.status})${detail}`,
          );
        }
        update({ state: "done" });
      } catch (reason) {
        update({
          state: "error",
          error:
            reason instanceof Error ? reason.message : "Asset upload failed.",
        });
      }
    },
    [registryBase, token, app.id],
  );

  const submit = async () => {
    if (!registryBase || !token || lintBlocked) return;
    const manifest = signedManifest ?? draft;
    const targetVersion = manifest.version?.trim() || version.trim();
    setSubmitState({ kind: "submitting" });
    try {
      const response = await fetch(`${registryBase}/v1/miniapps/submissions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ manifest }),
      });
      if (response.status === 200 || response.status === 201) {
        setSubmitState({
          kind: "success",
          created: response.status === 201,
          version: targetVersion,
        });
        setSubmittedVersion(targetVersion);
        if (iconAsset) {
          const asset = iconAsset;
          await uploadAsset(asset, targetVersion, (patch) =>
            setIconAsset((current) =>
              current && current.sha256 === asset.sha256
                ? { ...current, ...patch }
                : current,
            ),
          );
        }
        for (const asset of screenshots) {
          await uploadAsset(asset, targetVersion, (patch) =>
            setScreenshots((current) =>
              current.map((entry) =>
                entry.sha256 === asset.sha256 ? { ...entry, ...patch } : entry,
              ),
            ),
          );
        }
        return;
      }
      const detail = await readErrorDetail(response);
      const message =
        response.status === 401
          ? "Publisher token rejected (401). Check the token and try again."
          : response.status === 403
            ? `This miniapp id is owned by another publisher (403). Publish under a different id.${detail}`
            : response.status === 409
              ? `Version ${targetVersion} already exists with different content (409). Bump the version and resubmit.`
              : response.status === 422
                ? `The registry rejected the manifest as invalid (422)${detail}`
                : `Submission failed (${response.status})${detail}`;
      setSubmitState({ kind: "error", message });
    } catch {
      setSubmitState({ kind: "error", message: "Registry unreachable." });
    }
  };

  // Track the submitted version: poll versions + intake while the dialog is
  // open. Reopening the dialog with the same version resumes tracking.
  const trackedVersion = submittedVersion ?? version.trim();
  useEffect(() => {
    if (!isOpen || !registryBase || !token || !trackedVersion) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const versionsResponse = await fetch(
          `${registryBase}/v1/miniapps/${encodeURIComponent(app.id)}/versions`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        if (versionsResponse.ok) {
          const list = (await versionsResponse.json()) as VersionSummary[];
          const summary =
            list.find((entry) => entry.version === trackedVersion) ?? null;
          if (!cancelled) setVersionSummary(summary);
          if (summary) {
            const intakeResponse = await fetch(
              `${registryBase}/v1/miniapps/${encodeURIComponent(app.id)}/versions/${encodeURIComponent(trackedVersion)}/intake`,
              { headers: { authorization: `Bearer ${token}` } },
            );
            if (intakeResponse.ok && !cancelled) {
              setIntake((await intakeResponse.json()) as IntakeStatus);
            }
          }
        } else if (!cancelled) {
          setVersionSummary(null);
          setIntake(null);
        }
        if (!cancelled) setTrackingError("");
      } catch {
        if (!cancelled) setTrackingError("Registry unreachable.");
      }
      if (!cancelled) timer = setTimeout(poll, 10000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, registryBase, token, trackedVersion, app.id]);

  const latestReport = (stage: string): IntakeReport | null => {
    let latest: IntakeReport | null = null;
    for (const report of intake?.reports ?? []) {
      if (report.stage !== stage) continue;
      if (!latest || report.createdAt > latest.createdAt) latest = report;
    }
    return latest;
  };

  const currentKeyRow = fingerprint
    ? registeredKeys.find((row) => row.keyFingerprint === fingerprint)
    : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalHeader title={`Publish ${app.name}`} onClose={onClose} />
      <ModalBody className="space-y-6">
        {!registryBase && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-[var(--text-secondary)]">
            No miniapp registry is configured for this environment, so
            publishing is unavailable.
          </p>
        )}
        <Section
          title="Publisher token"
          description="Your bearer identity for the registry. Paste-only; stored in this browser profile."
        >
          <input
            type="password"
            value={token}
            onChange={(event) => persistToken(event.target.value)}
            placeholder="Paste your publisher token"
            className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm"
          />
        </Section>
        <Section
          title="Manifest lint"
          description="Errors block submission; warnings and info are advisory."
        >
          {findings.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-green-500">
              <CheckCircle size={15} />
              No issues found.
            </p>
          ) : (
            <ul className="space-y-2">
              {findings.map((finding, index) => (
                <LintRow key={`${finding.code}-${index}`} finding={finding} />
              ))}
            </ul>
          )}
        </Section>
        <Section
          title="Release"
          description="Version and changelog submitted with the manifest."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Version"
              value={version}
              onChange={onVersionChange}
              placeholder="1.0.0"
            />
            <Field
              label="Changelog"
              value={changelog}
              onChange={onChangelogChange}
              placeholder="What changed in this version"
            />
          </div>
        </Section>
        <Section
          title="What users will see"
          description="The plain-language permission summary shown on the marketplace listing."
        >
          {permissionExplanations.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              This miniapp declares no permissions or account connections.
            </p>
          ) : (
            <ul className="space-y-2">
              {permissionExplanations.map((explanation, index) => (
                <li key={index} className="text-xs">
                  <span className="font-medium">{explanation.title}</span>
                  <span className="text-[var(--text-secondary)]">
                    {" "}
                    — {explanation.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          title="Signing"
          description="Sign with an Ed25519 publisher key. The private key never leaves this machine."
        >
          {!signingAvailable ? (
            <p className="flex items-center gap-2 text-xs text-amber-500">
              <Warning size={15} />
              This environment does not support Ed25519 WebCrypto operations;
              signing is unavailable.
            </p>
          ) : !publicKey ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateKey()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
                >
                  <Key size={15} />
                  Generate key
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
                >
                  <DownloadSimple size={15} />
                  Import key backup
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importKeyFromFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Generating a key immediately downloads a JSON backup. Allternit
                never stores the private key — keep the backup safe.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                <p className="break-all">
                  <span className="text-[var(--text-tertiary)]">
                    Public key:{" "}
                  </span>
                  {publicKey}
                </p>
                <p className="mt-1 break-all">
                  <span className="text-[var(--text-tertiary)]">
                    Fingerprint:{" "}
                  </span>
                  {fingerprint || "…"}
                </p>
                {currentKeyRow && (
                  <p className="mt-1">
                    <span className="text-[var(--text-tertiary)]">
                      Registry status:{" "}
                    </span>
                    <span
                      className={
                        currentKeyRow.status === "active"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {currentKeyRow.status}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void registerKey()}
                  disabled={!token || !registryBase || registering}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)] disabled:opacity-50"
                >
                  {registering && (
                    <CircleNotch size={14} className="animate-spin" />
                  )}
                  Register public key
                </button>
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={signing}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)] disabled:opacity-50"
                >
                  {signing ? (
                    <CircleNotch size={14} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={15} />
                  )}
                  Sign manifest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSigningKey(null);
                    setPublicKey(null);
                    setSignedManifest(null);
                    setSignatureVerified(null);
                    setKeyNotice(null);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
                >
                  Forget key
                </button>
              </div>
              {signatureVerified === true && (
                <p className="flex items-center gap-2 text-xs text-green-500">
                  <CheckCircle size={15} />
                  Signature verified.
                </p>
              )}
              {signatureVerified === false && (
                <p className="flex items-center gap-2 text-xs text-red-500">
                  <XCircle size={15} />
                  Signature could not be verified; the manifest will be
                  submitted unsigned.
                </p>
              )}
            </div>
          )}
          {keyNotice && (
            <p
              className={`mt-3 text-xs ${keyNotice.kind === "error" ? "text-red-500" : "text-green-500"}`}
            >
              {keyNotice.text}
            </p>
          )}
          {token && registeredKeys.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Registered keys
              </p>
              {registeredKeys.map((row) => (
                <div
                  key={row.keyFingerprint}
                  className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-all font-mono text-[11px]">
                      {row.keyFingerprint.slice(0, 16)}…
                    </span>
                    <span
                      className={
                        row.status === "active"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {row.status}
                    </span>
                  </div>
                  {row.status !== "revoked" &&
                    (revokingFingerprint === row.keyFingerprint ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={revokeConfirmation}
                          onChange={(event) =>
                            setRevokeConfirmation(event.target.value)
                          }
                          placeholder="Type the full fingerprint to confirm"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => void revokeKey(row.keyFingerprint)}
                          disabled={revokeConfirmation !== row.keyFingerprint}
                          className="text-red-500 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRevokingFingerprint(null);
                            setRevokeConfirmation("");
                          }}
                          className="text-[var(--text-tertiary)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setRevokingFingerprint(row.keyFingerprint)
                        }
                        className="mt-2 text-[var(--text-tertiary)] hover:text-red-500"
                      >
                        Revoke this key
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
          {keysError && (
            <p className="mt-3 text-xs text-red-500">{keysError}</p>
          )}
        </Section>
        <Section
          title="Assets"
          description="Icon (png/svg/webp, up to 2 MB) and up to 5 screenshots (png/webp/jpeg, up to 10 MB each). Uploads happen when you submit."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {iconAsset ? (
                <AssetThumb
                  asset={iconAsset}
                  onRemove={() => {
                    URL.revokeObjectURL(iconAsset.previewUrl);
                    setIconAsset(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
                >
                  <CloudArrowUp size={15} />
                  Choose icon
                </button>
              )}
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void pickIcon(file);
                  event.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {screenshots.map((asset) => (
                <AssetThumb
                  key={asset.sha256}
                  asset={asset}
                  onRemove={() => {
                    URL.revokeObjectURL(asset.previewUrl);
                    setScreenshots((current) =>
                      current.filter((entry) => entry.sha256 !== asset.sha256),
                    );
                  }}
                />
              ))}
              {screenshots.length < MAX_SCREENSHOTS && (
                <button
                  type="button"
                  onClick={() => screenshotInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] px-3.5 text-sm text-[var(--text-secondary)]"
                >
                  <CloudArrowUp size={15} />
                  Add screenshot ({screenshots.length}/{MAX_SCREENSHOTS})
                </button>
              )}
              <input
                ref={screenshotInputRef}
                type="file"
                multiple
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void pickScreenshots(event.target.files);
                  }
                  event.target.value = "";
                }}
              />
            </div>
            {assetError && <p className="text-xs text-red-500">{assetError}</p>}
          </div>
        </Section>
        {submitState.kind === "success" && (
          <p className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-xs text-green-500">
            <CheckCircle size={15} />
            {submitState.created
              ? `Version ${submitState.version} submitted for review.`
              : `Version ${submitState.version} already existed with identical content; nothing changed.`}
          </p>
        )}
        {submitState.kind === "error" && (
          <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-500">
            <XCircle size={15} />
            {submitState.message}
          </p>
        )}
        {token && registryBase && (
          <Section
            title="Submission status"
            description="Intake pipeline for the current version, refreshed every 10 seconds."
          >
            {trackingError && (
              <p className="mb-2 text-xs text-red-500">{trackingError}</p>
            )}
            {!versionSummary ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                No submission found for version {trackedVersion || "—"} yet.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-1 font-medium">
                    {versionSummary.version} · {versionSummary.status}
                  </span>
                  <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[var(--text-secondary)]">
                    {intake?.job
                      ? `pipeline: ${intake.job.status} (attempt ${intake.job.attempts})`
                      : "pipeline: no job yet"}
                  </span>
                  {versionSummary.signed && (
                    <span className="flex items-center gap-1 text-green-500">
                      <ShieldCheck size={13} />
                      signed
                    </span>
                  )}
                </div>
                {intake?.job?.lastError && (
                  <p className="text-xs text-red-500">{intake.job.lastError}</p>
                )}
                <ul className="space-y-1.5">
                  {PIPELINE_STAGES.map((stage) => {
                    const report = latestReport(stage);
                    return (
                      <li
                        key={stage}
                        className="flex items-center gap-2 text-xs"
                      >
                        {report?.status === "pass" ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : report?.status === "warn" ? (
                          <Warning size={14} className="text-amber-500" />
                        ) : report?.status === "fail" ? (
                          <XCircle size={14} className="text-red-500" />
                        ) : (
                          <CircleNotch
                            size={14}
                            className="text-[var(--text-tertiary)]"
                          />
                        )}
                        <span className="capitalize">
                          {stage.replace(/_/g, " ")}
                        </span>
                        {report && (
                          <span className="text-[var(--text-tertiary)]">
                            {typeof report.summary === "string"
                              ? report.summary
                              : ""}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Section>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={
            !registryBase ||
            !token ||
            lintBlocked ||
            submitState.kind === "submitting"
          }
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
        >
          {submitState.kind === "submitting" && (
            <CircleNotch size={14} className="animate-spin" />
          )}
          {submitState.kind === "submitting"
            ? "Submitting…"
            : "Submit for review"}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function LintRow({ finding }: { finding: MiniAppLintFinding }) {
  const icon =
    finding.severity === "error" ? (
      <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
    ) : finding.severity === "warning" ? (
      <Warning size={15} className="mt-0.5 shrink-0 text-amber-500" />
    ) : (
      <ShieldCheck
        size={15}
        className="mt-0.5 shrink-0 text-[var(--text-tertiary)]"
      />
    );
  return (
    <li className="flex items-start gap-2 text-xs">
      {icon}
      <span>
        {finding.message}
        {finding.fix && (
          <span className="block text-[var(--text-tertiary)]">
            {finding.fix}
          </span>
        )}
      </span>
    </li>
  );
}

function AssetThumb({
  asset,
  onRemove,
}: {
  asset: AssetDraft;
  onRemove: () => void;
}) {
  return (
    <div className="w-28 rounded-lg border border-[var(--border-subtle)] p-2 text-center">
      <img
        src={asset.previewUrl}
        alt=""
        className="mx-auto size-16 rounded-md object-cover"
      />
      <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-tertiary)]">
        {asset.sha256.slice(0, 12)}
      </p>
      <p
        className={`text-[10px] ${
          asset.state === "done"
            ? "text-green-500"
            : asset.state === "error"
              ? "text-red-500"
              : "text-[var(--text-tertiary)]"
        }`}
        title={asset.error}
      >
        {asset.state === "uploading" ? "uploading…" : asset.state}
      </p>
      {asset.state !== "uploading" && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-0.5 text-[10px] text-[var(--text-tertiary)] hover:text-red-500"
        >
          Remove
        </button>
      )}
    </div>
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
