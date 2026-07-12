import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { theCatApiActionHandlers, validateTheCatApiCredential } from "./runtime.ts";

const service = "the_cat_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, theCatApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTheCatApiCredential({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
