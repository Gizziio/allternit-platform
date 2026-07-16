/**
 * Windows sandbox adapter — profile contract and helper discovery.
 *
 * Community runtimes on Windows are launched through a native helper,
 * `allternit-sandbox-helper.exe`, because Node exposes none of the required
 * primitives (AppContainer, restricted tokens, Job Objects, WFP). The helper
 * is a separately built and Authenticode-signed artifact; until it ships,
 * this adapter FAILS CLOSED and Windows community runtimes refuse to start —
 * identical behavior to before this adapter existed.
 *
 * ─── Contract with the native helper (see WindowsSandboxProfile) ────────────
 *
 * Invocation: `allternit-sandbox-helper.exe --profile <path-to-profile.json>`
 * The helper MUST, in order:
 *   1. Parse and validate the profile (schema version must be 1).
 *   2. Create an AppContainer with a per-miniapp SID derived from a hash of
 *      the command cwd (so two miniapps never share a container).
 *   3. Grant filesystem access ONLY through explicit capabilities:
 *      read paths  -> capability SIDs + ACL merge on those directories
 *      write paths -> same, with write access; everything else stays denied
 *      via the AppContainer's default DACL filtering.
 *   4. Build a restricted token (no elevated groups, LOW integrity) and the
 *      AppContainer token; never run the child with the user's full token.
 *   5. Create a Job Object before starting the child:
 *      maxMemoryMb   -> JOBOBJECT_EXTENDED_LIMIT_INFORMATION ProcessMemoryLimit
 *      maxProcesses  -> ActiveProcessLimit
 *      maxCpuSeconds -> PerProcessUserTimeLimit (100 ns units)
 *      (maxFileSizeMb has no Job Object equivalent; it is enforced on macOS/
 *      Linux only and MUST be documented as unenforced on Windows.)
 *   6. Install WFP filters before resuming the child:
 *      network.mode "none"     -> block all inbound+outbound at ALE layers
 *      network.mode "loopback" -> permit 127.0.0.0/8 + ::1 only; block all
 *                                 other outbound, including DNS (port 53), so
 *                                 external traffic can only leave through the
 *                                 Allternit policy proxy (injected via env)
 *      network.mode "full"     -> no WFP rules (install-time exception only)
 *   7. Launch the command suspended inside the container, assign the Job,
 *      resume, relay stdio verbatim, exit with the child's exit code, and
 *      remove the WFP filters on exit.
 *
 * The helper MUST NOT interpret profile fields as shell input: the command is
 * exec'd directly (CreateProcess with the binary and an argument vector).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { MiniAppSandboxPermissions, SandboxNetworkMode, SandboxResourceLimits, SandboxedCommand } from "./mini-app-sandbox.js";

// ─── Profile contract ─────────────────────────────────────────────────────────

export interface WindowsSandboxProfile {
  version: 1;
  filesystem: { read: string[]; write: string[] };
  network: { mode: "none" | "loopback" | "full"; allowedHosts: string[] };
  limits: {
    maxMemoryMb?: number;
    maxProcesses?: number;
    maxCpuSeconds?: number;
    /** No Job Object equivalent; documented as unenforced on Windows. */
    maxFileSizeMb?: number;
  };
  command: { binary: string; args: string[]; cwd: string };
}

export function buildWindowsSandboxProfile(
  binary: string,
  args: string[],
  workdir: string,
  permissions: MiniAppSandboxPermissions,
  networkMode: SandboxNetworkMode,
  limits: SandboxResourceLimits,
): WindowsSandboxProfile {
  const declared = (permissions.filesystem || []).map((location) => path.resolve(location));
  const write = [...new Set([path.resolve(workdir), ...declared])];
  return {
    version: 1,
    filesystem: { read: write, write },
    network: {
      mode: !permissions.network?.length ? "none" : networkMode,
      allowedHosts: permissions.network?.length ? [...permissions.network] : [],
    },
    limits: {
      ...(limits.maxMemoryMb ? { maxMemoryMb: Math.floor(limits.maxMemoryMb) } : {}),
      ...(limits.maxProcesses ? { maxProcesses: Math.floor(limits.maxProcesses) } : {}),
      ...(limits.maxCpuSeconds ? { maxCpuSeconds: Math.floor(limits.maxCpuSeconds) } : {}),
      ...(limits.maxFileSizeMb ? { maxFileSizeMb: Math.floor(limits.maxFileSizeMb) } : {}),
    },
    command: { binary, args, cwd: path.resolve(workdir) },
  };
}

// ─── Helper discovery and validation ─────────────────────────────────────────

const HELPER_NAME = "allternit-sandbox-helper.exe";
/** Authenticode subject the helper must be signed with on Windows. */
const HELPER_PUBLISHER = "Allternit";

export function windowsHelperCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const candidates: string[] = [];
  if (env.ALLTERNIT_WINDOWS_SANDBOX_HELPER) candidates.push(env.ALLTERNIT_WINDOWS_SANDBOX_HELPER);
  candidates.push(path.join(path.dirname(process.execPath), "resources", HELPER_NAME));
  candidates.push(path.join(path.dirname(process.execPath), HELPER_NAME));
  return candidates;
}

export function findWindowsHelper(env: NodeJS.ProcessEnv = process.env): string | null {
  return windowsHelperCandidates(env).find((candidate) => fs.existsSync(candidate)) || null;
}

/**
 * Validate the helper before trusting it. On Windows the Authenticode
 * signature must be valid and match the Allternit publisher. On other
 * platforms (development/testing) existence is sufficient.
 */
export function validateWindowsHelper(helperPath: string): string | null {
  if (process.platform !== "win32") return null;
  const escaped = helperPath.split("'").join("''");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `(Get-AuthenticodeSignature -FilePath '${escaped}') | Select-Object -ExpandProperty Status`],
    { encoding: "utf8", timeout: 15_000 },
  );
  if (result.status !== 0 || !result.stdout.trim().startsWith("Valid")) {
    return "sandbox helper failed Authenticode validation";
  }
  const subject = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `(Get-AuthenticodeSignature -FilePath '${escaped}').SignerCertificate.Subject`],
    { encoding: "utf8", timeout: 15_000 },
  );
  if (subject.status !== 0 || !subject.stdout.includes(HELPER_PUBLISHER)) {
    return "sandbox helper is not signed by the Allternit publisher";
  }
  return null;
}

// ─── Command construction ─────────────────────────────────────────────────────

const HELPER_UNAVAILABLE =
  "Community runtime sandboxing on Windows requires the Allternit sandbox helper, which is not installed";

/**
 * Build the sandboxed command for Windows. Intentionally has no platform
 * guard of its own (the caller guards) so the fail-closed path and command
 * construction stay testable on any platform.
 */
export function windowsSandboxCommand(
  binary: string,
  args: string[],
  workdir: string,
  permissions: MiniAppSandboxPermissions,
  networkMode: SandboxNetworkMode,
  limits: SandboxResourceLimits,
): SandboxedCommand {
  const helper = findWindowsHelper();
  if (!helper) return { error: HELPER_UNAVAILABLE };
  const invalid = validateWindowsHelper(helper);
  if (invalid) return { error: invalid };
  const profile = buildWindowsSandboxProfile(binary, args, workdir, permissions, networkMode, limits);
  const profilePath = path.join(workdir, ".allternit-sandbox-win.json");
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), { mode: 0o600 });
  return { binary: helper, args: ["--profile", profilePath] };
}
