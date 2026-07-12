import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePlunkCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePlunkCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
