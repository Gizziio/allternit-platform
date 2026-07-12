import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePexelsCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePexelsCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
