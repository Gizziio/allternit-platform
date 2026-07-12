import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePersonaCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePersonaCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
