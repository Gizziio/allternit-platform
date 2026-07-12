import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWinstonAiCredential, winstonAiActionHandlers } from "./runtime.ts";

const service = "winston_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, winstonAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWinstonAiCredential(input.apiKey, fetcher, signal);
  },
};
