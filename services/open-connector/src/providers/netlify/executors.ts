import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineBearerProviderExecutors } from "../provider-runtime.ts";
import { netlifyActionHandlers, validateNetlifyCredential } from "./runtime.ts";

const service = "netlify";

export const executors: ProviderExecutors = defineBearerProviderExecutors(service, netlifyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateNetlifyCredential(input.apiKey, fetcher);
  },
  async oauth2(input, { fetcher }) {
    return validateNetlifyCredential(input.accessToken, fetcher);
  },
};
