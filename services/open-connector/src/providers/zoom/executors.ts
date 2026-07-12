import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { fetchZoomCurrentAccount, zoomActionHandlers } from "./runtime.ts";

const service = "zoom";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, zoomActionHandlers);

export const credentialValidators: CredentialValidators = {
  oauth2(input, { fetcher, signal }) {
    return fetchZoomCurrentAccount(input.accessToken, input.metadata, fetcher, signal);
  },
};
