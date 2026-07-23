// @ts-nocheck
import { mock } from "bun:test"

const CERTIFICATE = {
  version: "1.0",
  task: {
    type: "patch_equivalence",
    description: "Test verification task",
  },
  definitions: [
    {
      id: "def-1",
      term: "patch",
      definition: "A set of changes to source code",
      source: "test",
    },
  ],
  premises: [
    {
      id: "prem-1",
      statement: "The patch fixes the reported issue",
      evidence: "Test evidence shows the patch resolves the problem",
      confidence: "high",
    },
    {
      id: "prem-2",
      statement: "The patch does not introduce regressions",
      evidence: "Test evidence shows no regressions in the modified files",
      confidence: "high",
    },
  ],
  executionTraces: [
    {
      id: "trace-1",
      codePath: ["src/file.ts:10", "src/file.ts:20"],
      description: "Trace through modified code path",
      verified: true,
    },
  ],
  edgeCases: [
    {
      id: "edge-1",
      description: "Empty input",
      handled: true,
      reasoning: "Code handles empty input gracefully",
    },
  ],
  conclusion: {
    answer: "passed",
    reasoning: "All premises verified with sufficient evidence",
    confidence: "high",
  },
}

/**
 * Mock the Provider and AI SDK for verification tests.
 * Patches Provider.getModel/getLanguage to return a fake model that yields
 * a deterministic VerificationCertificate.
 */
export async function mockGenerateObject() {
  const { Provider } = await import("@/runtime/providers/provider")
  const { generateObject } = await import("ai")

  // Patch Provider methods
  const originalDefaultModelConcrete = Provider.defaultModelConcrete
  const originalGetModel = Provider.getModel
  const originalGetLanguage = Provider.getLanguage

  Provider.defaultModelConcrete = async () => ({ providerID: "anthropic", modelID: "claude-sonnet-4-6" })
  Provider.getModel = async () => ({ providerID: "anthropic", modelID: "claude-sonnet-4-6" })
  Provider.getLanguage = async () => ({
    specificationVersion: "v2",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    supportedUrls: {},
  })

  // Patch generateObject if possible
  let originalGenerateObject: typeof generateObject | undefined
  try {
    const aiModule = await import("ai")
    originalGenerateObject = aiModule.generateObject
    // Note: direct property assignment on ESM namespace may not work
    // We rely on Provider patching instead
  } catch {
    // ignore
  }

  return {
    certificate: CERTIFICATE,
    restore: () => {
      Provider.defaultModelConcrete = originalDefaultModelConcrete
      Provider.getModel = originalGetModel
      Provider.getLanguage = originalGetLanguage
      if (originalGenerateObject) {
        try {
          // Attempt to restore
        } catch {
          // ignore
        }
      }
    },
  }
}

export function restoreMocks() {
  mock.restore()
}
