import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { uniswapApiActionHandlers, validateUniswapApiCredential } from "./runtime.ts";

const service = "uniswap_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, uniswapApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateUniswapApiCredential(input.apiKey, fetcher, signal);
  },
};
