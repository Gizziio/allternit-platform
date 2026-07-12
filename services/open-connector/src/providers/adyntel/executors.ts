import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { AdyntelContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { adyntelActionHandlers, requireAdyntelEmail, validateAdyntelCredential } from "./runtime.ts";

const service = "adyntel";

export const executors: ProviderExecutors = defineProviderExecutors<AdyntelContext>({
  service,
  handlers: adyntelActionHandlers,
  async createContext(context, fetcher): Promise<AdyntelContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      email: requireAdyntelEmail(optionalString(credential.values.email)),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateAdyntelCredential(input, { fetcher, signal });
  },
};
