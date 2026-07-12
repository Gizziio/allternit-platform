import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateQuoCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateQuoCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
