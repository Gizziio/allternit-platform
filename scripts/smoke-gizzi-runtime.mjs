#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.env.GIZZI_SMOKE_PORT || 4197);
const host = "127.0.0.1";
const password = process.env.GIZZI_SMOKE_PASSWORD || crypto.randomBytes(12).toString("hex");
const username = process.env.GIZZI_SMOKE_USERNAME || "gizzi";
const timeoutMs = Number(process.env.GIZZI_SMOKE_TIMEOUT_MS || 30000);

function resolveBinary(root) {
  const candidates = [
    path.join(root, "cmd", "gizzi-code", "dist", "gizzi-code"),
    path.join(root, "cmd", "gizzi-code", "dist", "gizzi-code-darwin-arm64"),
    path.join(root, "cmd", "gizzi-code", "dist", "gizzi-code.exe"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`gizzi binary not found. Checked:\n${candidates.join("\n")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ""}`);
}

async function main() {
  const binary = resolveBinary(repoRoot);
  const output = [];

  console.log(`[smoke] binary: ${binary}`);
  console.log(`[smoke] target: http://${host}:${port}`);

  const child = spawn(
    binary,
    ["serve", "--port", String(port), "--hostname", host, "--print-logs"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        GIZZI_SERVER_USERNAME: username,
        GIZZI_SERVER_PASSWORD: password,
        GIZZI_USERNAME: username,
        GIZZI_PASSWORD: password,
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const cleanup = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output.push(text);
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output.push(text);
    process.stderr.write(text);
  });

  try {
    await waitFor(async () => {
      const res = await fetch(`http://${host}:${port}/v1/global/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.status !== 401) {
        throw new Error(`expected 401 before auth, got ${res.status}`);
      }
      return res;
    }, "unauthenticated healthcheck");

    const token = Buffer.from(`${username}:${password}`).toString("base64");
    const authRes = await waitFor(async () => {
      const res = await fetch(`http://${host}:${port}/v1/global/health`, {
        headers: { Authorization: `Basic ${token}` },
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) {
        throw new Error(`expected 200 with auth, got ${res.status}`);
      }
      return res;
    }, "authenticated healthcheck");

    const authJson = await authRes.json();
    console.log(`[smoke] authenticated health ok: ${JSON.stringify(authJson)}`);

    await sleep(1000);

    const combinedOutput = output.join("");
    if (/ERROR .*failed to load watcher binding/m.test(combinedOutput)) {
      throw new Error("runtime emitted file watcher binding failure");
    }
    if (combinedOutput.includes("MODULE_NOT_FOUND")) {
      throw new Error("runtime emitted MODULE_NOT_FOUND during startup");
    }

    console.log("[smoke] PASS");
  } finally {
    cleanup();
    await new Promise((resolve) => child.once("exit", resolve));
    process.off("exit", cleanup);
  }
}

main().catch((error) => {
  console.error(`[smoke] FAIL: ${error.message}`);
  process.exitCode = 1;
});
