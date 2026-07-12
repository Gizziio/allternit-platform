import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { executeDeeplAction, validateDeeplCredential } from "./runtime.ts";

const service = "deepl";

const handlers: Record<string, (input: Record<string, unknown>, context: ApiKeyProviderContext) => Promise<unknown>> = {
  list_supported_languages(input, context) {
    return executeDeeplAction(
      { actionName: "list_supported_languages", input, apiKey: context.apiKey },
      context.fetcher,
    );
  },
  get_usage(input, context) {
    return executeDeeplAction({ actionName: "get_usage", input, apiKey: context.apiKey }, context.fetcher);
  },
  translate_text(input, context) {
    return executeDeeplAction({ actionName: "translate_text", input, apiKey: context.apiKey }, context.fetcher);
  },
};

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, handlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateDeeplCredential({ apiKey: input.apiKey }, fetcher);
  },
};
