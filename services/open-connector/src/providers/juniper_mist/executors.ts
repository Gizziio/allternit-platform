import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { JuniperMistActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { juniperMistActionHandlers, resolveJuniperMistApiBaseUrl, validateJuniperMistCredential } from "./runtime.ts";

const service = "juniper_mist";

export const executors: ProviderExecutors = defineProviderExecutors<JuniperMistActionContext>({
  service,
  handlers: juniperMistActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<JuniperMistActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: resolveJuniperMistApiBaseUrl(credential.metadata.apiBaseUrl ?? credential.values.apiBaseUrl),
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "Juniper Mist request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateJuniperMistCredential(input, fetcher, signal);
  },
};
