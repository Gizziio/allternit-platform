import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { ProviderFetch } from "../provider-runtime.ts";

import { defineProviderExecutors, ProviderRequestError } from "../provider-runtime.ts";
import { u301ActionHandlers, validateU301Credential } from "./runtime.ts";

const service = "u301";

interface U301ExecutorContext {
  apiKey: string;
  workspaceId?: string;
  fetcher: ProviderFetch;
  signal?: AbortSignal;
}

export const executors: ProviderExecutors = defineProviderExecutors<U301ExecutorContext>({
  service,
  handlers: u301ActionHandlers,
  async createContext(context: ExecutionContext, fetcher: ProviderFetch): Promise<U301ExecutorContext> {
    const credential = await context.getCredential(service);
    if (!credential || credential.authType !== "api_key") {
      throw new ProviderRequestError(401, "Configure u301 API key credentials first.");
    }
    return {
      apiKey: credential.apiKey,
      workspaceId: credential.values.workspaceId,
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateU301Credential({ apiKey: input.apiKey, workspaceId: input.values.workspaceId }, fetcher, signal);
  },
};
