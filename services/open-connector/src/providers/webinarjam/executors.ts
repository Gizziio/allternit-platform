import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWebinarjamCredential, webinarjamActionHandlers } from "./runtime.ts";

const service = "webinarjam";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, webinarjamActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }): ReturnType<typeof validateWebinarjamCredential> {
    return validateWebinarjamCredential({ apiKey: input.apiKey, fetcher, signal });
  },
};
