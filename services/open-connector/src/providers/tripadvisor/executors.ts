import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tripadvisorActionHandlers, validateTripadvisorCredential } from "./runtime.ts";

const service = "tripadvisor";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tripadvisorActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTripadvisorCredential,
};
