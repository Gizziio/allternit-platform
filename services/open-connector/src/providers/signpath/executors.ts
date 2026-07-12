import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateSignpathCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }): ReturnType<typeof validateSignpathCredential> {
    return validateSignpathCredential({ ...input.values, apiKey: input.apiKey }, fetcher);
  },
};
