#!/usr/bin/env node

import { performance } from "node:perf_hooks";

function readOptions(argv) {
  const options = {
    api:
      process.env.ALLTERNIT_CLOUD_API_URL ||
      "https://allternit-cloud-api.fly.dev",
    token: process.env.ALLTERNIT_CLERK_TOKEN || "",
    runtimeId: "",
    durationSeconds: 60,
    concurrency: 4,
    path: "/health",
    start: false,
    keepRunning: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--api") ((options.api = value), (index += 1));
    else if (arg === "--token") ((options.token = value), (index += 1));
    else if (arg === "--runtime-id")
      ((options.runtimeId = value), (index += 1));
    else if (arg === "--duration")
      ((options.durationSeconds = Number(value)), (index += 1));
    else if (arg === "--concurrency")
      ((options.concurrency = Number(value)), (index += 1));
    else if (arg === "--path") ((options.path = value), (index += 1));
    else if (arg === "--start") options.start = true;
    else if (arg === "--keep-running") options.keepRunning = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.api = options.api.replace(/\/$/, "");
  if (
    !Number.isFinite(options.durationSeconds) ||
    options.durationSeconds < 5 ||
    options.durationSeconds > 3600
  ) {
    throw new Error("--duration must be between 5 and 3600 seconds");
  }
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 100
  ) {
    throw new Error("--concurrency must be an integer between 1 and 100");
  }
  if (
    !options.path.startsWith("/") ||
    options.path.includes("..") ||
    options.path.includes("://")
  ) {
    throw new Error("--path must be a safe runtime-relative path");
  }
  return options;
}

function printHelp() {
  console.log(`Usage: ALLTERNIT_CLERK_TOKEN=... node scripts/hosted-runtime-relay-load.mjs [options]

Exercises a real hosted runtime through the authenticated Cloud API relay and
reports throughput, latency, runtime-hour usage, and estimated Fly cost.

Options:
  --runtime-id ID     Hosted instance ID or paired runtime device ID
  --duration SECONDS  Test duration (default: 60)
  --concurrency N     Concurrent relay requests (default: 4)
  --path PATH         Runtime path to request (default: /health)
  --start             Start a stopped hosted runtime, then stop it after the test
  --keep-running      Do not stop a machine that this script started
  --api URL           Cloud API base URL
  --token TOKEN       Clerk token (prefer ALLTERNIT_CLERK_TOKEN)
  --json              Print the final report as JSON`);
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.token)
    throw new Error("Set ALLTERNIT_CLERK_TOKEN or pass --token");

  const apiRequest = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${options.token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${options.api}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        payload.message ||
          payload.error ||
          `${path} returned ${response.status}`,
      );
    return payload;
  };

  const listRuntimes = () => apiRequest("/api/v1/hosted-runtimes");
  const entitlement = () => apiRequest("/api/v1/hosted-runtimes/entitlement");
  let runtimes = await listRuntimes();
  let hosted = options.runtimeId
    ? runtimes.find(
        (item) =>
          item.id === options.runtimeId ||
          item.runtimeDeviceId === options.runtimeId,
      )
    : runtimes.find(
        (item) => item.status === "running" && item.runtimeDeviceId,
      ) || runtimes.find((item) => item.runtimeDeviceId);
  if (!hosted)
    throw new Error(
      "No paired hosted runtime found. Create one in Settings → Plans & compute first.",
    );

  let startedByScript = false;
  if (hosted.status === "stopped") {
    if (!options.start)
      throw new Error(
        "The selected runtime is stopped. Pass --start to test and auto-stop it afterward.",
      );
    await apiRequest(
      `/api/v1/hosted-runtimes/${encodeURIComponent(hosted.id)}/start`,
      { method: "POST" },
    );
    startedByScript = true;
  }

  const stopTestRuntime = async () => {
    if (!startedByScript || options.keepRunning) return;
    await apiRequest(
      `/api/v1/hosted-runtimes/${encodeURIComponent(hosted.id)}/stop`,
      { method: "POST" },
    ).catch((error) =>
      console.error(`Warning: unable to stop test runtime: ${error.message}`),
    );
  };

  const readyDeadline = Date.now() + 120_000;
  try {
    while (Date.now() < readyDeadline) {
      runtimes = await listRuntimes();
      hosted = runtimes.find((item) => item.id === hosted.id) || hosted;
      if (hosted.runtimeDeviceId && hosted.status === "running") break;
      await sleep(2_000);
    }
  } catch (error) {
    await stopTestRuntime();
    throw error;
  }
  if (!hosted.runtimeDeviceId) {
    await stopTestRuntime();
    throw new Error("Hosted runtime did not pair within 120 seconds.");
  }

  const deviceId = hosted.runtimeDeviceId;
  const relayRequest = async () => {
    const startedAt = performance.now();
    try {
      const response = await fetch(
        `${options.api}/api/v1/runtime-devices/${encodeURIComponent(deviceId)}/proxy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method: "GET",
            path: options.path,
            headers: {},
            body: "",
            bodyEncoding: "utf8",
          }),
          signal: AbortSignal.timeout(100_000),
        },
      );
      await response.arrayBuffer();
      return {
        latencyMs: performance.now() - startedAt,
        status: response.status,
        ok: response.ok,
      };
    } catch (error) {
      return {
        latencyMs: performance.now() - startedAt,
        status: 0,
        ok: false,
        error: String(error),
      };
    }
  };

  let before;
  try {
    before = await entitlement();
  } catch (error) {
    await stopTestRuntime();
    throw error;
  }
  const testStartedAt = performance.now();
  const deadline = testStartedAt + options.durationSeconds * 1000;
  const results = [];
  const worker = async () => {
    while (performance.now() < deadline) results.push(await relayRequest());
  };

  try {
    await Promise.all(
      Array.from({ length: options.concurrency }, () => worker()),
    );
  } finally {
    await stopTestRuntime();
  }

  const elapsedSeconds = (performance.now() - testStartedAt) / 1000;
  const after = await entitlement();
  const successes = results.filter((result) => result.ok);
  const latencies = successes.map((result) => result.latencyMs);
  const statuses = Object.fromEntries(
    [...new Set(results.map((result) => result.status))]
      .sort((left, right) => left - right)
      .map((status) => [
        String(status),
        results.filter((result) => result.status === status).length,
      ]),
  );
  const usageDeltaSeconds = Math.max(
    0,
    after.usedSecondsMonthly - before.usedSecondsMonthly,
  );
  const costDeltaUsd = Math.max(
    0,
    after.estimatedCostUsdMonthly - before.estimatedCostUsdMonthly,
  );
  const report = {
    hostedInstanceId: hosted.id,
    runtimeDeviceId: deviceId,
    path: options.path,
    concurrency: options.concurrency,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    requests: results.length,
    successes: successes.length,
    errors: results.length - successes.length,
    requestsPerSecond: Number((successes.length / elapsedSeconds).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(latencies, 0.5).toFixed(1)),
      p95: Number(percentile(latencies, 0.95).toFixed(1)),
      p99: Number(percentile(latencies, 0.99).toFixed(1)),
      max: Number(Math.max(0, ...latencies).toFixed(1)),
    },
    statuses,
    metering: {
      usageDeltaSeconds,
      costDeltaUsd: Number(costDeltaUsd.toFixed(6)),
      estimatedCostPerRuntimeHourUsd:
        usageDeltaSeconds > 0
          ? Number(((costDeltaUsd / usageDeltaSeconds) * 3600).toFixed(4))
          : null,
      monthlyUsedSeconds: after.usedSecondsMonthly,
      monthlyEstimatedCostUsd: Number(after.estimatedCostUsdMonthly.toFixed(4)),
    },
    stoppedAfterTest: startedByScript && !options.keepRunning,
  };

  if (options.json) return console.log(JSON.stringify(report, null, 2));
  console.log(
    `Hosted relay: ${report.successes}/${report.requests} successful · ${report.requestsPerSecond} req/s`,
  );
  console.log(
    `Latency: p50 ${report.latencyMs.p50} ms · p95 ${report.latencyMs.p95} ms · p99 ${report.latencyMs.p99} ms`,
  );
  console.log(
    `Metering: ${usageDeltaSeconds}s · estimated $${report.metering.costDeltaUsd.toFixed(6)} · ${report.metering.estimatedCostPerRuntimeHourUsd == null ? "n/a" : `estimated $${report.metering.estimatedCostPerRuntimeHourUsd.toFixed(4)}/runtime-hour`}`,
  );
  console.log(`Statuses: ${JSON.stringify(statuses)}`);
}

main().catch((error) => {
  console.error(`Hosted runtime load test failed: ${error.message}`);
  process.exitCode = 1;
});
