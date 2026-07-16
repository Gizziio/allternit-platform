#!/usr/bin/env node
/**
 * Allternit miniapp intake worker (reference implementation).
 *
 * Claims intake jobs from the registry, runs the stages that can be executed
 * locally and honestly, and reports every other stage as a closed failure so
 * jobs can never sail through unverified:
 *
 *   - schema_validation    REAL — mirrors the registry's valid_manifest rule
 *                          (id string 2..200 chars, non-empty name/description,
 *                          category present).
 *   - signature_validation REAL — Ed25519 verification over the canonical
 *                          manifest serialization shared with the desktop
 *                          verifier (recursive key sort via localeCompare,
 *                          undefined-stripping, JSON.stringify, release.signature
 *                          removed but release.publisherKey retained).
 *   - the other 9 stages   reported as status "fail" with
 *                          summary.implemented = false. The registry requires
 *                          every stage to pass before a version becomes
 *                          reviewable, so unimplemented stages fail CLOSED.
 *                          Deploy isolated scanner workers (OSV, secret scan,
 *                          ClamAV, CycloneDX, disposable install/health/UI
 *                          runners) that implement them, or set
 *                          MINIAPP_INTAKE_ENFORCE=0 on the registry as a
 *                          staging-only escape hatch.
 *
 * Environment:
 *   REGISTRY_URL       (required) e.g. https://localhost:8443
 *   WORKER_TOKEN       (required) value of MINIAPP_INTAKE_WORKER_TOKEN
 *   WORKER_NAME        (optional) defaults to reference-worker-<host>-<pid>
 *   POLL_INTERVAL_MS   (optional) default 5000
 *   REGISTRY_INSECURE_TLS=1  allow self-signed registry certs (staging only)
 *
 * Zero dependencies; requires Node >= 20 for global fetch and WebCrypto.
 */
import crypto from "node:crypto";
import os from "node:os";
import { pathToFileURL } from "node:url";

const SCANNER = "allternit-reference-worker/1";

/** Stages the reference worker deliberately does not implement. */
const UNIMPLEMENTED_STAGES = [
  "repo_check",
  "license_check",
  "secret_scan",
  "dependency_scan",
  "malware_scan",
  "sbom",
  "install_test",
  "health_test",
  "ui_test",
];

const UNIMPLEMENTED_REASON =
  "reference worker implements local stages only; deploy an isolated scanner for this stage";

// ---------------------------------------------------------------------------
// Stage implementations (pure, exported for smoke tests)
// ---------------------------------------------------------------------------

/** Mirror of the registry's valid_manifest (services/registry/apps-registry/src/miniapps.rs). */
export function validateManifestShape(manifest) {
  const errors = [];
  const id = manifest && typeof manifest === "object" ? manifest.id : undefined;
  if (typeof id !== "string" || id.length < 2 || id.length > 200) {
    errors.push("id must be a string of 2..200 characters");
  }
  for (const field of ["name", "description"]) {
    const value = manifest?.[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (typeof manifest?.category !== "string") {
    errors.push("category must be a string");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Canonical manifest serialization for signatures. MUST stay byte-identical to
 * canonicalize() in surfaces/ai.allternit.com/src/views/aci/mini-app-manifest.ts.
 */
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function decodeBase64(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** SPKI DER prefix for Ed25519 (RFC 8410): the registry stores raw 32-byte keys. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify release.signature over the canonical manifest with release.publisherKey.
 * Mirrors verifyMiniAppManifestSignature in the desktop marketplace client.
 */
export function verifySignature(manifest) {
  const signature = manifest?.release?.signature;
  const publisherKey = manifest?.release?.publisherKey;
  if (!signature || !publisherKey) {
    return { ok: false, reason: "release.signature and release.publisherKey are required" };
  }
  try {
    const rawKey = decodeBase64(publisherKey);
    if (rawKey.length !== 32) {
      return { ok: false, reason: `publisherKey must decode to 32 bytes, got ${rawKey.length}` };
    }
    const unsigned = {
      ...manifest,
      release: { ...manifest.release, signature: undefined },
    };
    const payload = Buffer.from(JSON.stringify(canonicalize(unsigned)), "utf8");
    const key = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
      format: "der",
      type: "spki",
    });
    const ok = crypto.verify(null, payload, key, decodeBase64(signature));
    return ok ? { ok: true } : { ok: false, reason: "signature does not verify" };
  } catch (error) {
    return { ok: false, reason: `verification error: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// Registry client
// ---------------------------------------------------------------------------

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[intake-worker] ${name} is required`);
    process.exit(2);
  }
  return value.replace(/\/+$/, "");
}

async function api(config, method, path, body) {
  const response = await fetch(`${config.registryUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.workerToken}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`registry ${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function claimJob(config) {
  return api(config, "POST", "/v1/intake/jobs/claim", { worker: config.workerName });
}

async function reportResult(config, jobId, stage, status, summary) {
  await api(config, "POST", `/v1/intake/jobs/${encodeURIComponent(jobId)}/results`, {
    worker: config.workerName,
    stage,
    scanner: SCANNER,
    status,
    summary,
  });
}

async function failJob(config, jobId, error) {
  try {
    await api(config, "POST", `/v1/intake/jobs/${encodeURIComponent(jobId)}/fail`, {
      worker: config.workerName,
      error: String(error && error.message ? error.message : error).slice(0, 1000),
    });
  } catch (reportError) {
    console.error(`[intake-worker] failed to report job failure: ${reportError.message}`);
  }
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

async function processJob(config, job) {
  const manifest = job.manifest;
  console.log(
    `[intake-worker] claimed job ${job.jobId} for ${job.miniappId}@${job.version}`,
  );

  const shape = validateManifestShape(manifest);
  await reportResult(
    config,
    job.jobId,
    "schema_validation",
    shape.valid ? "pass" : "fail",
    shape.valid ? { implemented: true } : { implemented: true, errors: shape.errors },
  );

  const signature = verifySignature(manifest);
  await reportResult(
    config,
    job.jobId,
    "signature_validation",
    signature.ok ? "pass" : "fail",
    signature.ok
      ? { implemented: true, publisherKey: manifest?.release?.publisherKey }
      : { implemented: true, reason: signature.reason },
  );

  // Fail closed for everything this worker cannot honestly execute.
  for (const stage of UNIMPLEMENTED_STAGES) {
    await reportResult(config, job.jobId, stage, "fail", {
      implemented: false,
      reason: UNIMPLEMENTED_REASON,
    });
  }

  console.log(`[intake-worker] job ${job.jobId} reported (2 real stages, 9 closed failures)`);
}

async function main() {
  if (process.env.REGISTRY_INSECURE_TLS === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const config = {
    registryUrl: requiredEnv("REGISTRY_URL"),
    workerToken: requiredEnv("WORKER_TOKEN"),
    workerName:
      process.env.WORKER_NAME || `reference-worker-${os.hostname()}-${process.pid}`,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 5000),
  };
  console.log(
    `[intake-worker] ${config.workerName} polling ${config.registryUrl} every ${config.pollIntervalMs}ms`,
  );

  for (;;) {
    try {
      const job = await claimJob(config);
      if (job) {
        try {
          await processJob(config, job);
        } catch (error) {
          console.error(`[intake-worker] job ${job.jobId} crashed: ${error.message}`);
          await failJob(config, job.jobId, error);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
      }
    } catch (error) {
      console.error(`[intake-worker] poll error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    }
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
