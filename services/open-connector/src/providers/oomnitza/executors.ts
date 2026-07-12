import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { OomnitzaActionContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { oomnitzaActionHandlers, resolveOomnitzaCredential, validateOomnitzaCredential } from "./runtime.ts";

const service = "oomnitza";

export const executors: ProviderExecutors = defineProviderExecutors<OomnitzaActionContext>({
  service,
  handlers: oomnitzaActionHandlers,
  async createContext(context, fetcher): Promise<OomnitzaActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    const resolvedCredential = resolveOomnitzaCredential(
      credential.apiKey,
      optionalString(credential.metadata.baseUrl) ?? optionalString(credential.values.baseUrl),
    );
    return {
      ...resolvedCredential,
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOomnitzaCredential(
      {
        apiKey: input.apiKey,
        baseUrl: input.values.baseUrl,
      },
      fetcher,
      signal,
    );
  },
};
