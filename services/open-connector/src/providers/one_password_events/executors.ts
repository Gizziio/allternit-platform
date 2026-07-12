import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { OnePasswordEventsContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import {
  onePasswordEventsActionHandlers,
  resolveOnePasswordEventsCredentialContext,
  validateOnePasswordEventsCredential,
} from "./runtime.ts";

const service = "one_password_events";

export const executors: ProviderExecutors = defineProviderExecutors<OnePasswordEventsContext>({
  service,
  handlers: onePasswordEventsActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<OnePasswordEventsContext> {
    const credential = await requireApiKeyCredential(context, service);
    return resolveOnePasswordEventsCredentialContext(
      credential.apiKey,
      credential.values,
      credential.metadata,
      fetcher,
      context.signal,
    );
  },
  fallbackMessage: "one_password_events request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOnePasswordEventsCredential(input.apiKey, input.values, fetcher, signal);
  },
};
