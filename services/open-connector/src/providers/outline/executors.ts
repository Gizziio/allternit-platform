import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { normalizeOutlineBaseUrl, outlineActionHandlers, validateOutlineCredential } from "./runtime.ts";

const service = "outline";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: outlineActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: normalizeOutlineBaseUrl(credential.metadata.baseUrl ?? credential.values.baseUrl),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOutlineCredential(
      {
        apiKey: input.apiKey,
        baseUrl: input.values.baseUrl,
      },
      fetcher,
      signal,
    );
  },
};
