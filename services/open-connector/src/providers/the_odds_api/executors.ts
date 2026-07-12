import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { theOddsApiActionHandlers, validateTheOddsApiCredential } from "./runtime.ts";

const service = "the_odds_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, theOddsApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTheOddsApiCredential,
};
