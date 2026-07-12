import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { klangioActionHandlers, validateKlangioCredential } from "./runtime.ts";

const service = "klangio";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, klangioActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateKlangioCredential({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
