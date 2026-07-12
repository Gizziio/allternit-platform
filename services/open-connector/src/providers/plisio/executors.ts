import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePlisioCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePlisioCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
