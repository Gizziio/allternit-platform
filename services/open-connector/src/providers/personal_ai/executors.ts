import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePersonalAiCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePersonalAiCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
