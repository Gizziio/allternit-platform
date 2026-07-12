import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePerplexityCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePerplexityCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
