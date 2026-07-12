import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { BotpressContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, ProviderRequestError, requireApiKeyCredential } from "../provider-runtime.ts";
import { botpressActionHandlers, validateBotpressCredential } from "./runtime.ts";

const service = "botpress";

export const executors: ProviderExecutors = defineProviderExecutors<BotpressContext>({
  service,
  handlers: botpressActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<BotpressContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      workspaceId:
        optionalString(credential.values.workspaceId) ??
        optionalString(credential.metadata.workspaceId) ??
        missingWorkspaceId(),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBotpressCredential(input, fetcher, signal);
  },
};

function missingWorkspaceId(): never {
  throw new ProviderRequestError(400, "botpress workspaceId is required");
}
