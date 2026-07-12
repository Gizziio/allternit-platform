import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { TruveraActionContext } from "./runtime.ts";

import { defineProviderExecutors } from "../provider-runtime.ts";
import { createTruveraContext, truveraActionHandlers, validateTruveraCredential } from "./runtime.ts";

const service = "truvera";

export const executors: ProviderExecutors = defineProviderExecutors<TruveraActionContext>({
  service,
  handlers: truveraActionHandlers,
  createContext: createTruveraContext,
});

export const credentialValidators: CredentialValidators = {
  apiKey: validateTruveraCredential,
};
