import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { beaconchainActionHandlers, validateBeaconchainCredential } from "./runtime.ts";

const service = "beaconchain";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, beaconchainActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBeaconchainCredential(input.apiKey, fetcher, signal);
  },
};
