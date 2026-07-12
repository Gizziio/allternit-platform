import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateParseurCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateParseurCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
