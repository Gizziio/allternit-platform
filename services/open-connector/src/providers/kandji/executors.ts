import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { KandjiActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { kandjiActionHandlers, normalizeKandjiApiUrl, validateKandjiCredential } from "./runtime.ts";

const service = "kandji";

export const executors: ProviderExecutors = defineProviderExecutors<KandjiActionContext>({
  service,
  handlers: kandjiActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<KandjiActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiUrl: normalizeKandjiApiUrl(credential.metadata.apiUrl ?? credential.values.apiUrl),
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "Kandji request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateKandjiCredential(input, fetcher, signal);
  },
};
