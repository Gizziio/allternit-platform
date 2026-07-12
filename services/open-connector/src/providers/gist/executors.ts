import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { GistActionContext } from "./runtime-shared.ts";

import { defineProviderExecutors, requireBearerCredential } from "../provider-runtime.ts";
import { gistActionHandlers, validateGistCredential } from "./runtime.ts";

const service = "gist";

export const executors: ProviderExecutors = defineProviderExecutors<GistActionContext>({
  service,
  handlers: gistActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<GistActionContext> {
    const credential = await requireBearerCredential(context, service);
    return {
      accessToken: credential.accessToken,
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "GitHub Gist request failed.",
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGistCredential(input.apiKey, fetcher, signal);
  },
  async oauth2(input, { fetcher, signal }) {
    return validateGistCredential(input.accessToken, fetcher, signal);
  },
};
