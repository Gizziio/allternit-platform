import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { jigsawstackActionHandlers, validateJigsawstackCredential } from "./runtime.ts";

const service = "jigsawstack";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, jigsawstackActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateJigsawstackCredential,
};
