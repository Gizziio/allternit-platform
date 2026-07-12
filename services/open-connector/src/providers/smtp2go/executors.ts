import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { smtp2goActionHandlers, validateSmtp2goCredential } from "./runtime.ts";

const service = "smtp2go";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, smtp2goActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSmtp2goCredential(input.apiKey, fetcher, signal);
  },
};
