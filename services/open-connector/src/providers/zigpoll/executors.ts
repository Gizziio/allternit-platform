import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateZigpollCredential, zigpollActionHandlers } from "./runtime.ts";

const service = "zigpoll";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, zigpollActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateZigpollCredential({ apiKey: input.apiKey }, fetcher, signal);
  },
};
