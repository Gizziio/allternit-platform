import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePdfmonkeyCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePdfmonkeyCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
