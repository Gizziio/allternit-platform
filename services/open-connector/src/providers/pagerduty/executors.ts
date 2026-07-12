import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { pagerDutyActionHandlers, validatePagerDutyCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("pagerduty", pagerDutyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validatePagerDutyCredential({ apiKey: input.apiKey }, fetcher);
  },
};
