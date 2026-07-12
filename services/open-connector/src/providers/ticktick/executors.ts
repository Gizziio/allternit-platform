import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineBearerProviderExecutors } from "../provider-runtime.ts";
import { fetchTicktickCurrentAccount, ticktickActionHandlers, validateTicktickCredential } from "./runtime.ts";

const service = "ticktick";

export const executors: ProviderExecutors = defineBearerProviderExecutors(service, ticktickActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTicktickCredential,
  async oauth2(input, { fetcher, signal }) {
    return fetchTicktickCurrentAccount(input.accessToken, fetcher, signal);
  },
};
