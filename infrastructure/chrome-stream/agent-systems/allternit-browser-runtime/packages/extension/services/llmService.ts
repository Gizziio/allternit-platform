import type {
  ClientModelReference,
  LLMGenerateParams,
  LLMGenerateResult,
  ModelConfig,
} from "@allternit/browser-runtime-protocol/types";
import { LLMGenerateParamsSchema } from "@allternit/browser-runtime-protocol/schemas";
import { createAiSdkLanguageModel, generateWithAiSdk } from "../llm/aiSdkClient.js";
import { generateWithClientLlm, type ClientLlmRequest } from "../llm/clientLlmClient.js";

/**
 * Allternit Browser Runtime — self-hosted fork: the Browserbase Model Gateway
 * (`auto` model path) is stripped. Model inference requires either a client
 * model reference (the SDK host's `generate` callback) or an explicit
 * provider ModelConfig with an API key.
 */
export async function generate(
  model: ModelConfig | ClientModelReference | undefined,
  input: LLMGenerateParams,
  clientRequest: ClientLlmRequest,
): Promise<LLMGenerateResult> {
  const params = LLMGenerateParamsSchema.parse(input);

  if (model && "source" in model) {
    return await generateWithClientLlm(clientRequest, params);
  }

  if (!model?.apiKey) {
    throw new Error(
      "Model inference requires a client model callback or a provider model config with an API key",
    );
  }

  return await generateWithAiSdk(createAiSdkLanguageModel(model, params), params);
}
