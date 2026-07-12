import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { glyphicActionHandlers, validateGlyphicCredential } from "./runtime.ts";

const service = "glyphic";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, glyphicActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateGlyphicCredential(input.apiKey, fetcher, signal);
  },
};
