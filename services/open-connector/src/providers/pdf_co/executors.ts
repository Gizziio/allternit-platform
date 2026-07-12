import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePdfCoCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePdfCoCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
