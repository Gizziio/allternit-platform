import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { SevenShiftsContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { sevenShiftsActionHandlers, validateSevenShiftsCredential } from "./runtime.ts";

const service = "7_shifts";

export const executors: ProviderExecutors = defineProviderExecutors<SevenShiftsContext>({
  service,
  handlers: sevenShiftsActionHandlers,
  async createContext(context, fetcher): Promise<SevenShiftsContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      companyGuid: optionalString(credential.values.companyGuid),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSevenShiftsCredential(input, fetcher, signal);
  },
};
