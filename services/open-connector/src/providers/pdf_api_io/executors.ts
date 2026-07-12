import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePdfApiIoCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePdfApiIoCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
