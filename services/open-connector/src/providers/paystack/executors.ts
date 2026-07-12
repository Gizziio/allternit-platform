import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePaystackCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePaystackCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
