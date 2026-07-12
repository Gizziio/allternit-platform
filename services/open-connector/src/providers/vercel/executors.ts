import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateVercelCredential, vercelActionHandlers } from "./runtime.ts";

const service = "vercel";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, vercelActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateVercelCredential(input.apiKey, fetcher);
  },
};
