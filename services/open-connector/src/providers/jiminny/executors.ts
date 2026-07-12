import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { JiminnyActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { jiminnyActionHandlers, resolveJiminnyApiBaseUrl, validateJiminnyCredential } from "./runtime.ts";

const service = "jiminny";

export const executors: ProviderExecutors = defineProviderExecutors<JiminnyActionContext>({
  service,
  handlers: jiminnyActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<JiminnyActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: resolveJiminnyApiBaseUrl({ ...credential.values, ...credential.metadata }),
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "Jiminny request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateJiminnyCredential(input, fetcher, signal);
  },
};
