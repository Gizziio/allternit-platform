import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { HoneycombActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { honeycombActionHandlers, resolveHoneycombApiBaseUrl, validateHoneycombCredential } from "./runtime.ts";

const service = "honeycomb";

export const executors: ProviderExecutors = defineProviderExecutors<HoneycombActionContext>({
  service,
  handlers: honeycombActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<HoneycombActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: resolveHoneycombApiBaseUrl({
        values: credential.values,
        metadata: credential.metadata,
      }),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, options) {
    return validateHoneycombCredential(input, options);
  },
};
