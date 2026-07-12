import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateVerifiedemailCredential, verifiedemailActionHandlers } from "./runtime.ts";

const service = "verifiedemail";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, verifiedemailActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateVerifiedemailCredential,
};
