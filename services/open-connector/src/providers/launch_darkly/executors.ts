import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { launchDarklyActionHandlers, validateLaunchDarklyCredential } from "./runtime.ts";

const service = "launch_darkly";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, launchDarklyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateLaunchDarklyCredential(input.apiKey, fetcher, signal);
  },
};
