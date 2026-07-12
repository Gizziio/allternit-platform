import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tavilyActionHandlers, validateTavilyCredential } from "./runtime.ts";

const service = "tavily";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tavilyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTavilyCredential,
};
