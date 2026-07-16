import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { windowsSandboxCommand } from "./mini-app-sandbox-windows.js";

export type MiniAppSandboxPermissions = {
  network?: string[];
  filesystem?: string[];
  processes?: boolean;
};
export type SandboxedCommand =
  | { binary: string; args: string[] }
  | { error: string };

/**
 * Network posture for a sandboxed command that declares network permissions:
 *
 * - `loopback` (default): the process may bind and reach loopback only. DNS
 *   is blocked, so external traffic can only leave through the Allternit
 *   policy proxy (see `mini-app-policy-proxy.ts`), which enforces the
 *   approved hostname list. Used for runtime start/health/stop commands.
 * - `full`: unrestricted network. Reserved for install-time dependency
 *   resolution (`npm ci`, command-based installers), which legitimately
 *   needs package registries beyond the runtime host list. Never use for
 *   steady-state runtime execution.
 *
 * macOS enforcement was verified empirically with sandbox-exec: loopback-only
 * profiles allow 127.0.0.1 connects/binds, external TCP fails with EPERM at
 * the syscall, and DNS resolution is denied.
 */
export type SandboxNetworkMode = "loopback" | "full";

/**
 * Best-effort resource limits applied inside the sandbox.
 *
 * Enforcement reality by platform (verified empirically on macOS):
 * - `maxFileSizeMb`: RLIMIT_FSIZE via ulimit, works on macOS and Linux
 *   (bash uses 1024-byte blocks; the process is killed with SIGXFSZ).
 * - `maxCpuSeconds`: RLIMIT_CPU via ulimit, works on macOS and Linux
 *   (SIGXCPU). Per-process; a forking workload can evade it — cgroups
 *   CPUQuota is the real fix and needs the systemd scope path.
 * - `maxMemoryMb`: NOT enforceable via ulimit on macOS (setrlimit RLIMIT_AS
 *   and RLIMIT_DATA both return EINVAL there). On Linux it is enforced via a
 *   systemd --user scope (MemoryMax) when systemd-run is available;
 *   otherwise the limit is skipped and logged by the caller.
 * - `maxProcesses`: RLIMIT_NPROC is per-UID (not per-sandbox) on both
 *   platforms, so it is never set via ulimit — a low value would break the
 *   whole user session. On Linux it is enforced via systemd TasksMax when
 *   available.
 *
 * Total disk usage per app is not capped yet (needs APFS quotas / cgroup
 * io.max); the release installer caps extracted size at 2 GiB instead.
 */
export type SandboxResourceLimits = {
  maxCpuSeconds?: number;
  maxFileSizeMb?: number;
  maxMemoryMb?: number;
  maxProcesses?: number;
};

/** Applied to every sandboxed community command unless a caller overrides. */
export const DEFAULT_SANDBOX_LIMITS: SandboxResourceLimits = {
  maxFileSizeMb: 1024,
};

// ─── Path helpers ─────────────────────────────────────────────────────────────

function expandHome(location: string): string {
  return location.startsWith("~/")
    ? path.join(process.env.HOME || "", location.slice(2))
    : location;
}

/** Seatbelt filters match canonical paths: /tmp must become /private/tmp. */
export function canonicalSandboxPath(location: string): string {
  const resolved = path.resolve(location);
  const missing: string[] = [];
  let ancestor = resolved;
  while (!fs.existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  let base: string;
  try {
    base = fs.realpathSync(ancestor);
  } catch {
    base = ancestor;
  }
  return missing.length ? path.join(base, ...missing) : base;
}

function quote(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * All seatbelt forms of a location. macOS mixes symlinked paths (/tmp →
 * /private/tmp — seatbelt wants the resolved form) with firmlinks (/etc,
 * /var — seatbelt keeps the given form while realpath returns /private/…).
 * Rather than guessing which is which, grant every form.
 */
export function seatbeltPathForms(location: string): string[] {
  return [...new Set([path.resolve(location), canonicalSandboxPath(location)])];
}

/**
 * Seatbelt checks read permission on every path component, so each granted
 * subpath also needs literal grants on its ancestors (directory listing
 * only — no file contents below them become readable).
 */
export function seatbeltAncestorLiterals(locations: string[]): string[] {
  const literals = new Set<string>();
  for (const location of locations) {
    let current = path.dirname(location);
    while (current !== "/" && current !== path.dirname(current)) {
      literals.add(current);
      current = path.dirname(current);
    }
  }
  return [...literals];
}

/** Raw read-grant paths (all seatbelt forms), before sexpr rendering. */
export function macReadGrantPaths(home: string): string[] {
  const systemReads = [
    "/System",
    "/usr",
    "/bin",
    "/sbin",
    "/opt",
    "/dev",
    "/etc",
    "/var/folders",
    "/tmp",
    "/var/tmp",
    "/var/db/timezone",
    "/var/select",
  ];
  const homeToolReads = [
    ".nvm",
    ".volta",
    ".pyenv",
    ".asdf",
    ".local",
    ".bun",
    ".deno",
    ".cargo",
    ".rustup",
    ".sdkman",
    ".npm",
    "Library/pnpm",
  ].map((entry) => path.join(home, entry));
  const paths = new Set<string>();
  for (const location of [...systemReads, ...homeToolReads]) {
    if (!fs.existsSync(location)) continue;
    for (const form of seatbeltPathForms(location)) paths.add(form);
  }
  return [...paths];
}

/**
 * Read grants for the default macOS profile. Reads are granted by
 * enumeration, NOT by a blanket allow: macOS seatbelt does not honor
 * subpath deny rules once `(allow file-read*)` matches (verified
 * empirically), so sensitive locations are protected simply by never
 * being listed. Toolchain directories under $HOME are included so nvm/
 * volta/pyenv-style interpreters keep working; credential stores
 * (~/.ssh, ~/.aws, ~/Library/Keychains, browser profiles, …) are not.
 */
export function macReadGrants(home: string): string[] {
  return [
    '(allow file-read* (literal "/"))',
    ...macReadGrantPaths(home).map((form) => `(allow file-read* (subpath "${quote(form)}"))`),
  ];
}

export function buildMacProfile(
  workdir: string,
  permissions: MiniAppSandboxPermissions,
  networkMode: SandboxNetworkMode,
  home: string = process.env.HOME || "",
): string {
  const readPaths = macReadGrantPaths(home);
  const writable = [...new Set([workdir, ...(permissions.filesystem || []).map(expandHome)].flatMap(seatbeltPathForms))];
  const ancestors = seatbeltAncestorLiterals([...readPaths, ...writable]);
  const network = !permissions.network?.length
    ? []
    : networkMode === "full"
      ? ["(allow network*)"]
      : [
          // Loopback only: serve the UI, reach the policy proxy, talk to
          // co-sandboxed subprocesses. No DNS, no external egress.
          '(allow network-bind (local ip "localhost:*"))',
          '(allow network-inbound (local ip "localhost:*"))',
          '(allow network-outbound (remote ip "localhost:*"))',
        ];
  return [
    "(version 1)",
    "(deny default)",
    "(allow process-exec)",
    "(allow process-fork)",
    "(allow signal)",
    "(allow sysctl-read)",
    '(allow file-read* (literal "/"))',
    // Directory-listing grants so the kernel can walk to every subpath below.
    ...ancestors.map((location) => `(allow file-read* (literal "${quote(location)}"))`),
    ...readPaths.map((location) => `(allow file-read* (subpath "${quote(location)}"))`),
    // Writable locations are readable as well (no blanket read exists now).
    ...writable.map((location) => `(allow file-read* (subpath "${quote(location)}"))`),
    ...writable.map((location) => `(allow file-write* (subpath "${quote(location)}"))`),
    ...network,
  ].join("\n");
}

// ─── Resource limits ──────────────────────────────────────────────────────────

/**
 * ulimit-based limits applied inside the sandbox via a shell wrapper.
 * bash uses 1024-byte blocks for -f (verified on macOS and Linux). Memory
 * and process limits are intentionally not set here (see the type docs).
 */
export function buildLimitsScript(limits: SandboxResourceLimits): string {
  const commands: string[] = [];
  if (limits.maxFileSizeMb && limits.maxFileSizeMb > 0) {
    commands.push(`ulimit -f ${Math.floor(limits.maxFileSizeMb * 1024)}`);
  }
  if (limits.maxCpuSeconds && limits.maxCpuSeconds > 0) {
    commands.push(`ulimit -t ${Math.floor(limits.maxCpuSeconds)}`);
  }
  return commands.length ? `${commands.join("; ")}; ` : "";
}

/**
 * systemd --user scope prefix for cgroup v2 enforcement (Linux only).
 * Returns null when no cgroup-backed limit is requested.
 */
export function buildSystemdRunPrefix(limits: SandboxResourceLimits): string[] | null {
  const properties: string[] = [];
  if (limits.maxMemoryMb && limits.maxMemoryMb > 0) {
    properties.push("-p", `MemoryMax=${Math.floor(limits.maxMemoryMb)}M`);
  }
  if (limits.maxProcesses && limits.maxProcesses > 0) {
    properties.push("-p", `TasksMax=${Math.floor(limits.maxProcesses)}`);
  }
  if (!properties.length) return null;
  return ["systemd-run", "--user", "--scope", "--quiet", "--collect", ...properties, "--"];
}

// ─── Helper validation (macOS) ────────────────────────────────────────────────

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
let helperVerdict: string | null | undefined;

/**
 * Validate the sandbox-exec helper before trusting it: present, owned by
 * root:wheel, not writable by group/other, and carrying a valid Apple code
 * signature. Cached per process; any failure disables community runtimes
 * (fail closed).
 */
export function validateSandboxHelper(): string | null {
  if (helperVerdict !== undefined) return helperVerdict;
  helperVerdict = (() => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(SANDBOX_EXEC);
    } catch {
      return "macOS sandbox-exec is unavailable";
    }
    if (stat.uid !== 0 || stat.gid !== 0 || (stat.mode & 0o022) !== 0) {
      return "sandbox-exec has unexpected ownership or permissions";
    }
    const codesign = spawnSync("/usr/bin/codesign", ["--verify", SANDBOX_EXEC], { stdio: "ignore" });
    if (codesign.status !== 0) return "sandbox-exec failed code-signature validation";
    return null;
  })();
  return helperVerdict;
}

// ─── Command construction ─────────────────────────────────────────────────────

function wrapWithLimits(
  binary: string,
  args: string[],
  limits: SandboxResourceLimits,
): { binary: string; args: string[] } {
  const script = buildLimitsScript(limits);
  if (!script) return { binary, args };
  return { binary: "/bin/sh", args: ["-c", `${script}exec "$@"`, "sh", binary, ...args] };
}

export function sandboxCommand(
  binary: string,
  args: string[],
  workdir: string,
  permissions: MiniAppSandboxPermissions,
  networkMode: SandboxNetworkMode = "loopback",
  limits: SandboxResourceLimits = DEFAULT_SANDBOX_LIMITS,
): SandboxedCommand {
  const limited = wrapWithLimits(binary, args, limits);
  if (process.platform === "darwin") {
    const invalid = validateSandboxHelper();
    if (invalid) return { error: invalid };
    const profilePath = path.join(workdir, ".allternit-sandbox.sb");
    fs.writeFileSync(profilePath, buildMacProfile(workdir, permissions, networkMode), {
      mode: 0o600,
    });
    return { binary: SANDBOX_EXEC, args: ["-f", profilePath, limited.binary, ...limited.args] };
  }
  if (process.platform === "linux") {
    const bwrap = ["/usr/bin/bwrap", "/bin/bwrap"].find(fs.existsSync);
    if (!bwrap)
      return {
        error: "Bubblewrap is required to run community miniapps on Linux",
      };
    const mounts = (permissions.filesystem || []).flatMap((location) => {
      const expanded = expandHome(location);
      return ["--bind", expanded, expanded];
    });
    // NOTE: bwrap alone cannot distinguish loopback from external egress, so
    // on Linux a declared network permission still grants full network. The
    // policy proxy environment is injected by the caller and cooperating
    // clients honor it, but per-host enforcement requires the network
    // namespace adapter (veth + policy routing) tracked as sandbox hardening.
    const bwrapArgs = [
      "--die-with-parent",
      "--new-session",
      "--cap-drop",
      "ALL",
      "--hostname",
      "allternit-sandbox",
      "--unshare-all",
      ...(permissions.network?.length ? ["--share-net"] : []),
      "--ro-bind",
      "/",
      "/",
      "--tmpfs",
      "/tmp",
      "--bind",
      workdir,
      workdir,
      ...mounts,
      "--chdir",
      workdir,
      limited.binary,
      ...limited.args,
    ];
    // cgroup v2 limits via a systemd --user scope when available; without it
    // the ulimit wrapper above still applies file-size and CPU-time limits.
    const scope =
      process.platform === "linux" && fs.existsSync("/usr/bin/systemd-run")
        ? buildSystemdRunPrefix(limits)
        : null;
    if (scope) return { binary: "/usr/bin/systemd-run", args: [...scope.slice(1), bwrap, ...bwrapArgs] };
    return { binary: bwrap, args: bwrapArgs };
  }
  if (process.platform === "win32") {
    // Windows goes through the native sandbox helper (AppContainer + Job
    // Object + WFP); without the helper installed this fails closed.
    // The ulimit wrapper is POSIX-only, so the raw command is passed.
    return windowsSandboxCommand(binary, args, workdir, permissions, networkMode, limits);
  }
  return {
    error: `Community runtime sandboxing is not available on ${process.platform}`,
  };
}
