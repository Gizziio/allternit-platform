import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { deepgramActionHandlers, validateDeepgramCredential } from "./runtime.ts";

const service = "deepgram";

const handlers = Object.fromEntries(
  Object.entries(deepgramActionHandlers).map(([name, handler]) => [
    name,
    (input: Record<string, unknown>, context: ApiKeyProviderContext) => handler(input, context.fetcher, context.apiKey),
  ]),
) as Record<string, (input: Record<string, unknown>, context: ApiKeyProviderContext) => Promise<unknown>>;

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, handlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateDeepgramCredential({ apiKey: input.apiKey }, fetcher);
  },
};
