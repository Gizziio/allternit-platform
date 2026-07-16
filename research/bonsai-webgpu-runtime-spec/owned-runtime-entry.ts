import { OwnedBonsaiPipeline } from "../../surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/owned-pipeline";

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

window.addEventListener("unhandledrejection", event => {
  console.error("unhandledrejection reason:", event.reason);
  if (event.reason instanceof Error) console.error(event.reason.stack);
});

async function run() {
  console.log("stage: create-start");
  const pipeline = await OwnedBonsaiPipeline.create();
  console.log("stage: create-done");
  const start = Date.now();
  const blob = await pipeline.generate({
    prompt: "a red cube",
    width: 512,
    height: 512,
    numInferenceSteps: 4,
    seed: 42,
    onProgress: progress => console.log(`stage: ${progress.stage} ${progress.completed}/${progress.total}`),
  });
  const durationMs = Date.now() - start;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pngSha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  console.log("stage: complete", durationMs, bytes.length, pngSha256);
  const result = { ok: true as const, pngByteLength: bytes.length, pngSha256, durationMs };
  console.log("setting __ownedResult:", JSON.stringify(result));
  (window as unknown as Record<string, unknown>).__ownedResult = result;
}

run().catch(error => {
  console.error("run failed:", error);
  console.error("run failed type:", typeof error, "isError:", error instanceof Error);
  if (error instanceof Error) console.error(error.stack);
  (window as unknown as Record<string, unknown>).__ownedResult = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
});
