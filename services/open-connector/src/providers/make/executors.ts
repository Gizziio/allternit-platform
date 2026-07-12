import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { makeActionHandlers, resolveMakeZoneUrl, validateMakeCredential } from "./runtime.ts";

const service = "make";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: makeActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      zoneUrl: resolveMakeZoneUrl(credential),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateMakeCredential(
      {
        apiKey: input.apiKey,
        zoneUrl: input.values.zoneUrl,
      },
      fetcher,
      signal,
    );
  },
};
