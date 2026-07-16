/**
 * Pre-submission lint for miniapp manifests. Pure and React-free so it can be
 * exercised with plain node.
 *
 * Layers marketplace publishing rules on top of the base schema validation in
 * `mini-app-manifest.ts`. Every finding carries an actionable `fix` so the
 * publish dialog can tell the publisher exactly what to change. Findings with
 * severity "error" block submission.
 */

import { validateMiniAppManifest } from "./mini-app-manifest";
import type {
  MiniAppManifest,
  MiniAppOAuthProviderContract,
} from "./mini-app.types";

export type MiniAppLintSeverity = "error" | "warning" | "info";

export interface MiniAppLintFinding {
  severity: MiniAppLintSeverity;
  /** Stable machine-readable rule id, e.g. "version-semver". */
  code: string;
  message: string;
  /** Actionable guidance for resolving the finding. */
  fix?: string;
}

export interface MiniAppLintOptions {
  /** Set when the caller will sign before submitting; suppresses the
   * unsigned-release info finding. */
  signed?: boolean;
}

/** semver.org 2.0.0, anchored. */
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function lintOAuthProvider(
  providerId: string,
  provider: MiniAppOAuthProviderContract,
  findings: MiniAppLintFinding[],
): void {
  for (const [field, value] of [
    ["authorizationUrl", provider.authorizationUrl],
    ["tokenUrl", provider.tokenUrl],
  ] as const) {
    let url: URL | null = null;
    try {
      url = new URL(value);
    } catch {
      url = null;
    }
    if (!url) {
      findings.push({
        severity: "error",
        code: "oauth-url-invalid",
        message: `OAuth provider "${providerId}" has an invalid ${field}.`,
        fix: `Set oauth.${providerId}.${field} to a full https:// URL.`,
      });
      continue;
    }
    if (url.protocol !== "https:" && !isLocalHostname(url.hostname)) {
      findings.push({
        severity: "error",
        code: "oauth-url-https",
        message: `OAuth provider "${providerId}" uses insecure ${url.protocol}// for ${field}.`,
        fix: `Use an https:// URL for oauth.${providerId}.${field}; plain http is only allowed for localhost during development.`,
      });
    }
  }
  if (!provider.scopes?.length) {
    findings.push({
      severity: "error",
      code: "oauth-scopes-empty",
      message: `OAuth provider "${providerId}" declares no scopes.`,
      fix: `List the scopes the miniapp needs in oauth.${providerId}.scopes so users see what access is requested.`,
    });
  }
}

/**
 * Lint a manifest the way the publisher portal does before submission.
 * `validateMiniAppManifest` runs first; its messages map to error findings.
 */
export function lintMiniAppManifest(
  manifest: MiniAppManifest,
  opts?: MiniAppLintOptions,
): MiniAppLintFinding[] {
  const findings: MiniAppLintFinding[] = [];

  const validation = validateMiniAppManifest(manifest);
  if (!validation.valid) {
    for (const message of validation.errors) {
      findings.push({
        severity: "error",
        code: "schema",
        message,
        fix: "Fix the manifest structure; see the miniapp manifest contract.",
      });
    }
  }

  const version = manifest.version?.trim();
  if (!version) {
    findings.push({
      severity: "error",
      code: "version-missing",
      message: "A version is required to publish.",
      fix: 'Set "version" to a semver string such as "1.0.0".',
    });
  } else if (!SEMVER_PATTERN.test(version)) {
    findings.push({
      severity: "error",
      code: "version-semver",
      message: `Version "${manifest.version}" is not valid semver.`,
      fix: 'Use full semver "MAJOR.MINOR.PATCH" (e.g. "1.2.0"), without a leading "v" or leading zeros.',
    });
  }

  if (!manifest.release?.changelog?.trim()) {
    findings.push({
      severity: "warning",
      code: "changelog-missing",
      message: "No release changelog.",
      fix: "Add release.changelog so users know what changed in this version.",
    });
  }

  const mode = manifest.presentation?.mode;
  if (
    (mode === "embedded" || mode === "hybrid") &&
    !manifest.lifecycle?.health?.url?.trim()
  ) {
    findings.push({
      severity: "warning",
      code: "health-check-missing",
      message: `The ${mode} presentation has no lifecycle.health.url.`,
      fix: "Add lifecycle.health with an http url so the intake health test can verify the app starts.",
    });
  }

  if (
    manifest.lifecycle?.install?.command?.trim() &&
    !manifest.lifecycle?.start?.command?.trim()
  ) {
    findings.push({
      severity: "error",
      code: "lifecycle-start-missing",
      message: "lifecycle.install is declared without lifecycle.start.",
      fix: "Add a start command; the desktop cannot launch an app it can only install.",
    });
  }

  for (const entry of manifest.permissions?.network ?? []) {
    const value = entry.trim();
    if (!value) continue;
    if (
      value.includes("://") ||
      value.includes("/") ||
      value.includes("@") ||
      /\s/.test(value)
    ) {
      findings.push({
        severity: "error",
        code: "network-host-format",
        message: `Network permission "${entry}" is not a bare hostname.`,
        fix: 'Declare hosts only, e.g. "api.example.com" or "localhost:3000" — no scheme, path, or credentials.',
      });
    }
  }

  for (const name of manifest.permissions?.secrets ?? []) {
    if (!SECRET_NAME_PATTERN.test(name)) {
      findings.push({
        severity: "error",
        code: "secret-name-format",
        message: `Secret name "${name}" is not a valid environment variable name.`,
        fix: "Use 2–128 characters: uppercase letters, digits, and underscores, starting with a letter (e.g. OPENAI_API_KEY).",
      });
    }
  }

  for (const entry of manifest.permissions?.filesystem ?? []) {
    const value = entry.trim();
    if (!value) continue;
    const absolute =
      value.startsWith("/") ||
      value === "~" ||
      value.startsWith("~/") ||
      /^[a-zA-Z]:[\\/]/.test(value);
    if (!absolute) {
      findings.push({
        severity: "error",
        code: "filesystem-path-format",
        message: `Filesystem permission "${entry}" is not an absolute path.`,
        fix: 'Use absolute paths ("/data/records") or home-relative paths ("~/Documents/project").',
      });
    }
  }

  if (!manifest.icon?.trim()) {
    findings.push({
      severity: "warning",
      code: "icon-missing",
      message: "No icon.",
      fix: "Add an icon (png/svg/webp) in the publish dialog so the listing is recognizable.",
    });
  }

  const descriptionLength = (manifest.description ?? "").trim().length;
  if (descriptionLength < 20) {
    findings.push({
      severity: "warning",
      code: "description-short",
      message: `Description is only ${descriptionLength} characters.`,
      fix: "Write at least 20 characters describing what the miniapp does.",
    });
  }

  if (manifest.downloadable && !manifest.repo?.trim()) {
    findings.push({
      severity: "warning",
      code: "repo-missing",
      message: "The miniapp is downloadable but declares no repo.",
      fix: 'Set "repo" to "owner/repo" so the desktop can download and install it.',
    });
  }

  for (const [providerId, provider] of Object.entries(manifest.oauth ?? {})) {
    lintOAuthProvider(providerId, provider, findings);
  }

  if (!opts?.signed && !manifest.release?.signature?.trim()) {
    findings.push({
      severity: "info",
      code: "signature-missing",
      message: "This release is not signed.",
      fix: "Sign before submitting for verification.",
    });
  }

  if (
    manifest.compatibility?.platforms &&
    manifest.compatibility.platforms.length === 0
  ) {
    findings.push({
      severity: "info",
      code: "platforms-empty",
      message: "No target platforms declared.",
      fix: "List compatibility.platforms (darwin, win32, linux) so users know where the miniapp runs.",
    });
  }

  return findings;
}

/** True when any finding blocks submission. */
export function hasLintErrors(findings: MiniAppLintFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}
