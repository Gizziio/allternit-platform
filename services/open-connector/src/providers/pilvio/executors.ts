import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePilvioCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePilvioCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
