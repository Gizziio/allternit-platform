import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";
import type { TurbotPipesContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { createTurbotPipesContext, turbotPipesActionHandlers, validateTurbotPipesCredential } from "./runtime.ts";

const service = "turbot_pipes";

export const executors: ProviderExecutors = defineProviderExecutors<TurbotPipesContext>({
  service,
  handlers: turbotPipesActionHandlers,
  async createContext(context, fetcher) {
    const credential = await requireApiKeyCredential(context, service);
    const providerContext: ApiKeyProviderContext = {
      apiKey: credential.apiKey,
      fetcher,
      signal: context.signal,
    };
    if (context.transitFiles) providerContext.transitFiles = context.transitFiles;
    return createTurbotPipesContext(providerContext, credential.values);
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey: validateTurbotPipesCredential,
};
