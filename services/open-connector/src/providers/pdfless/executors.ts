import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePdflessCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePdflessCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
