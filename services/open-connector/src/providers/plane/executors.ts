import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { planeActionHandlers, validatePlaneCredential } from "./runtime.ts";

const service = "plane";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: planeActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      apiBaseUrl: optionalString(credential.values.apiBaseUrl) ?? optionalString(credential.metadata.apiBaseUrl),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validatePlaneCredential(input.apiKey, optionalString(input.values.apiBaseUrl), fetcher, signal);
  },
};
