import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { createMetatextaiContext, metatextaiActionHandlers, validateMetatextaiCredential } from "./runtime.ts";

const service = "metatextai";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: metatextaiActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return createMetatextaiContext(credential.apiKey, credential.values.applicationId, fetcher, context.signal);
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateMetatextaiCredential(input.apiKey, input.values.applicationId, fetcher, signal);
  },
};
