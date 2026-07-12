import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { IntercomActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireOAuthCredential } from "../provider-runtime.ts";
import { intercomActionHandlers, validateIntercomOAuthCredential } from "./runtime.ts";

const service = "intercom";

export const executors: ProviderExecutors = defineProviderExecutors<IntercomActionContext>({
  service,
  handlers: intercomActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<IntercomActionContext> {
    const credential = await requireOAuthCredential(context, service);
    return {
      accessToken: credential.accessToken,
      fetcher,
      providerMetadata: credential.metadata,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher, signal }) {
    return validateIntercomOAuthCredential(input, fetcher, signal);
  },
};
