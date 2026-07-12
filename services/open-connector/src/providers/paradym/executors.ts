import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateParadymCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateParadymCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
