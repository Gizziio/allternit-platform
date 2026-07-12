import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { squareActionHandlers, validateSquareCredential } from "./runtime.ts";

const service = "square";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, squareActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSquareCredential(input.apiKey, fetcher, signal);
  },
};
