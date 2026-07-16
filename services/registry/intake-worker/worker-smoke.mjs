/**
 * Smoke test for the reference intake worker (worker.mjs).
 * Run from the repo root (needs the marketplace-verify hooks for the
 * desktop TypeScript imports):
 *   node --import "data:text/javascript,import { register } from 'node:module'; \
 *     register('file://'$PWD'/scripts/marketplace-verify/hooks.mjs');" \
 *     services/registry/intake-worker/worker-smoke.mjs
 *
 * verify.sh runs this as part of the marketplace verification battery.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workerPath = path.join(repoRoot, "services/registry/intake-worker/worker.mjs");
const repoFile = (relative) =>
  pathToFileURL(path.join(repoRoot, relative)).href;

const worker = await import(pathToFileURL(workerPath).href);
const desktopManifest = await import(
  repoFile("surfaces/ai.allternit.com/src/views/aci/mini-app-manifest.ts")
);
const desktopSigning = await import(
  repoFile("surfaces/ai.allternit.com/src/views/aci/mini-app-signing.ts")
);

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok - ${name}`);
    });
}

// 1. Canonicalizer is byte-identical to the desktop verifier's.
await check("canonicalize matches desktop byte-for-byte", () => {
  const vectors = [
    { b: 1, a: { d: undefined, c: [3, { y: 2, x: 1 }] }, z: "s" },
    { release: { signature: undefined, publisherKey: "k", changelog: "c" }, id: "x" },
    { nested: [{ b: true, a: null }], num: 1.5, empty: {}, arr: [] },
    { unicode: "héllo wörld", emoji: "🚀", deep: { z: 1, a: 2, m: { q: undefined } } },
  ];
  for (const vector of vectors) {
    assert.equal(
      JSON.stringify(worker.canonicalize(vector)),
      JSON.stringify(desktopManifest.canonicalize(vector)),
    );
  }
});

// 2. Schema shape mirrors the registry rule.
await check("validateManifestShape mirrors registry valid_manifest", () => {
  const good = { id: "pub.app", name: "App", description: "d", category: "tools" };
  assert.equal(worker.validateManifestShape(good).valid, true);
  assert.equal(worker.validateManifestShape({ ...good, id: "x" }).valid, false);
  assert.equal(worker.validateManifestShape({ ...good, id: "x".repeat(201) }).valid, false);
  assert.equal(worker.validateManifestShape({ ...good, name: "  " }).valid, false);
  assert.equal(worker.validateManifestShape({ ...good, description: 5 }).valid, false);
  assert.equal(worker.validateManifestShape({ ...good, category: undefined }).valid, false);
  assert.equal(worker.validateManifestShape(null).valid, false);
});

// 3. Desktop-signed manifest verifies under the worker (and desktop verifier).
const key = await desktopSigning.generateSigningKey();
const imported = await desktopSigning.importSigningKey(key.privateKeyPkcs8);
assert.equal(imported.publicKey, key.publicKey);
const baseManifest = {
  id: "acme.weather",
  name: "Weather",
  description: "Weather miniapp",
  category: "utilities",
  version: "1.0.0",
  permissions: { network: ["api.weather.example"] },
  release: { changelog: "initial" },
};
const signed = await desktopSigning.signManifest(baseManifest, imported.key, key.publicKey);

await check("worker verifies a desktop-signed manifest", () => {
  assert.equal(worker.verifySignature(signed).ok, true);
});
await check("desktop verifier accepts the same manifest", async () => {
  assert.equal(await desktopManifest.verifyMiniAppManifestSignature(signed), true);
});
await check("tampered manifest fails worker verification", () => {
  assert.equal(worker.verifySignature({ ...signed, name: "Evil" }).ok, false);
});
await check("missing signature/key fails closed", () => {
  assert.equal(worker.verifySignature({ ...signed, release: {} }).ok, false);
  assert.equal(worker.verifySignature({ id: "x" }).ok, false);
});
await check("node:crypto-signed payload verifies (RFC 8032 agreement)", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const rawPub = pair.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const manifest = {
    id: "n.c", name: "N", description: "d", category: "c",
    release: { publisherKey: rawPub.toString("base64") },
  };
  const unsigned = { ...manifest, release: { ...manifest.release, signature: undefined } };
  const payload = Buffer.from(JSON.stringify(worker.canonicalize(unsigned)), "utf8");
  const sig = crypto.sign(null, payload, pair.privateKey);
  const signedManifest = {
    ...manifest,
    release: { ...manifest.release, signature: sig.toString("base64") },
  };
  assert.equal(worker.verifySignature(signedManifest).ok, true);
});

// 4. End-to-end against a fake registry: two jobs (good signature, bad signature).
const reported = [];
const claims = [];
const jobs = [
  { jobId: "job-good", miniappId: "acme.weather", version: "1.0.0", manifest: signed },
  {
    jobId: "job-bad",
    miniappId: "acme.evil",
    version: "0.1.0",
    manifest: { ...signed, id: "acme.evil", name: "Evil" },
  },
];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    assert.equal(req.headers.authorization, "Bearer test-token");
    const parsed = body ? JSON.parse(body) : null;
    if (req.url === "/v1/intake/jobs/claim") {
      claims.push(parsed);
      const job = jobs.shift() || null;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(job));
      return;
    }
    const resultMatch = req.url.match(/^\/v1\/intake\/jobs\/([^/]+)\/results$/);
    if (resultMatch) {
      reported.push({ jobId: resultMatch[1], ...parsed });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const child = spawn(process.execPath, [workerPath], {
  env: {
    ...process.env,
    REGISTRY_URL: `http://127.0.0.1:${port}`,
    WORKER_TOKEN: "test-token",
    WORKER_NAME: "smoke-worker",
    POLL_INTERVAL_MS: "50",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let childLog = "";
child.stdout.on("data", (d) => (childLog += d));
child.stderr.on("data", (d) => (childLog += d));

const deadline = Date.now() + 15000;
await new Promise((resolve, reject) => {
  const timer = setInterval(() => {
    if (reported.length >= 22) {
      clearInterval(timer);
      resolve();
    } else if (Date.now() > deadline) {
      clearInterval(timer);
      reject(new Error(`timed out; got ${reported.length} reports\n${childLog}`));
    }
  }, 50);
});
child.kill("SIGTERM");
server.close();

const REQUIRED = [
  "schema_validation", "signature_validation", "repo_check", "license_check",
  "secret_scan", "dependency_scan", "malware_scan", "sbom", "install_test",
  "health_test", "ui_test",
];

await check("e2e: all 11 stages reported for both jobs", () => {
  for (const jobId of ["job-good", "job-bad"]) {
    const stages = reported.filter((r) => r.jobId === jobId).map((r) => r.stage);
    assert.deepEqual(stages.sort(), [...REQUIRED].sort());
  }
});
await check("e2e: good manifest passes schema + signature, fails 9 closed", () => {
  const good = reported.filter((r) => r.jobId === "job-good");
  const byStage = Object.fromEntries(good.map((r) => [r.stage, r]));
  assert.equal(byStage.schema_validation.status, "pass");
  assert.equal(byStage.signature_validation.status, "pass");
  for (const stage of REQUIRED.slice(2)) {
    assert.equal(byStage[stage].status, "fail", stage);
    assert.equal(byStage[stage].summary.implemented, false, stage);
  }
});
await check("e2e: tampered manifest fails signature_validation", () => {
  const bad = reported.filter((r) => r.jobId === "job-bad");
  const byStage = Object.fromEntries(bad.map((r) => [r.stage, r]));
  assert.equal(byStage.schema_validation.status, "pass");
  assert.equal(byStage.signature_validation.status, "fail");
});
await check("e2e: worker identity + scanner tag sent", () => {
  assert.ok(claims.length >= 2);
  assert.equal(claims[0].worker, "smoke-worker");
  assert.ok(reported.every((r) => r.worker === "smoke-worker"));
  assert.ok(reported.every((r) => r.scanner === "allternit-reference-worker/1"));
});

console.log(`\nworker smoke: ${passed} passed`);
