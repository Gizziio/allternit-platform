import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateParallelCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateParallelCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
