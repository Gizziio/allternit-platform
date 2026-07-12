import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePingdomCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePingdomCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
