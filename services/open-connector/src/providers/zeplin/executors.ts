import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { zeplinActionHandlers, validateZeplinCredential } from "./runtime.ts";

const service = "zeplin";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, zeplinActionHandlers);

export const credentialValidators: CredentialValidators = {
  oauth2(input, { fetcher, signal }) {
    return validateZeplinCredential(input.accessToken, fetcher, signal);
  },
};
