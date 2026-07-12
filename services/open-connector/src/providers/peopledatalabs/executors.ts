import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePeopledatalabsCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePeopledatalabsCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
