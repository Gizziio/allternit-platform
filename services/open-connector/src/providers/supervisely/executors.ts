import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { superviselyActionHandlers, validateSuperviselyCredential } from "./runtime.ts";

const service = "supervisely";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, superviselyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSuperviselyCredential(input, fetcher, signal);
  },
};
