import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateProjectmanagerCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateProjectmanagerCredential({ apiKey: input.apiKey, fetcher });
  },
};
