import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { HighLevelContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { highLevelActionHandlers, readHighLevelLocationId, validateHighLevelCredential } from "./runtime.ts";

const service = "high_level";

export const executors: ProviderExecutors = defineProviderExecutors<HighLevelContext>({
  service,
  handlers: highLevelActionHandlers,
  async createContext(context, fetcher): Promise<HighLevelContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      locationId: readHighLevelLocationId(credential.values.locationId),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateHighLevelCredential(input.apiKey, readHighLevelLocationId(input.values.locationId), fetcher, signal);
  },
};
