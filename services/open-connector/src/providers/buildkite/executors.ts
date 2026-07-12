import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { buildkiteActionHandlers, validateBuildkiteCredential } from "./runtime.ts";

const service = "buildkite";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, buildkiteActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBuildkiteCredential({ apiKey: input.apiKey, fetcher, signal });
  },
};
