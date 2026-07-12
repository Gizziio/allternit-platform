import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { jamieActionHandlers, readJamieKeyScope, validateJamieCredential } from "./runtime.ts";

const service = "jamie";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: jamieActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      keyScope: readJamieKeyScope(
        optionalString(credential.values.keyScope) ?? optionalString(credential.metadata.keyScope),
      ),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey: validateJamieCredential,
};
