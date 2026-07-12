import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { celigoActionHandlers, resolveCeligoApiBaseUrl, validateCeligoCredential } from "./runtime.ts";

const service = "celigo";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: celigoActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: resolveCeligoApiBaseUrl(credential.metadata.apiBaseUrl ?? credential.values.apiBaseUrl),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateCeligoCredential(
      {
        apiKey: input.apiKey,
        ...input.values,
      },
      fetcher,
      signal,
    );
  },
};
