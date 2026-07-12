import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { XataContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { validateXataCredential, xataActionHandlers } from "./runtime.ts";

const service = "xata";

export const executors: ProviderExecutors = defineProviderExecutors<XataContext>({
  service,
  handlers: xataActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<XataContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateXataCredential(input.apiKey, fetcher, signal);
  },
};
