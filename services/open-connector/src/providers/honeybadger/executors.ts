import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { HoneybadgerActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { honeybadgerActionHandlers, resolveHoneybadgerApiBaseUrl, validateHoneybadgerCredential } from "./runtime.ts";

const service = "honeybadger";

export const executors: ProviderExecutors = defineProviderExecutors<HoneybadgerActionContext>({
  service,
  handlers: honeybadgerActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<HoneybadgerActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: resolveHoneybadgerApiBaseUrl({
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
    return validateHoneybadgerCredential(input, options);
  },
};
