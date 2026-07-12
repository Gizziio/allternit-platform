import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateParsehubCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateParsehubCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
