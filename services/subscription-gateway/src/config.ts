// §1 config — env (SUBS_GATEWAY_*) + optional flat-key policy file.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TcpConfig {
  enabled: boolean;
  host: string;
  port: number;
}

export interface Config {
  stateDir: string;
  dbPath: string;
  artifactsDir: string;
  udsPath: string;
  tcp: TcpConfig;
  policyPath: string;
  policy: Record<string, string>;
  // Base URL of the local allternit-api (CommRails peer messages, D12).
  apiBase: string;
}

const ENV_PREFIX = "SUBS_GATEWAY_";

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

// Content-addressed artifact location: <artifactsDir>/<sha256[0:2]>/<sha256>.
export function artifactPath(config: Config, sha256: string): string {
  return join(config.artifactsDir, sha256.slice(0, 2), sha256);
}

// Minimal hand-rolled YAML subset: flat `key: value` pairs only. `#` comment
// lines and blank lines are skipped; values may be single- or double-quoted.
// No nesting, lists, anchors, or multi-line values — by design, so the daemon
// carries no YAML dependency. Anything more complex belongs in env vars.
export function parsePolicyFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2];
    out[m[1]] = value;
  }
  return out;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const stateDir = expandHome(
    env[`${ENV_PREFIX}STATE_DIR`] ?? "~/.allternit/subscriptions/"
  );
  const policyPath = join(stateDir, "policy.yaml");
  const policy = existsSync(policyPath)
    ? parsePolicyFile(readFileSync(policyPath, "utf8"))
    : {};
  return {
    stateDir,
    dbPath: join(stateDir, "state.db"),
    artifactsDir: join(stateDir, "artifacts"),
    udsPath: join(stateDir, "gateway.sock"),
    tcp: {
      enabled: env[`${ENV_PREFIX}TCP`] === "1",
      host: env[`${ENV_PREFIX}TCP_HOST`] ?? "127.0.0.1",
      port: Number(env[`${ENV_PREFIX}TCP_PORT`] ?? "7788"),
    },
    policyPath,
    policy,
    apiBase: env[`${ENV_PREFIX}API_BASE`] ?? "http://127.0.0.1:18013",
  };
}
