import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { dida365ActionHandlers, fetchDida365CurrentAccount } from "./runtime.ts";

const service = "dida365";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, dida365ActionHandlers);

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher, signal }) {
    return fetchDida365CurrentAccount(input.accessToken, fetcher, signal);
  },
};
