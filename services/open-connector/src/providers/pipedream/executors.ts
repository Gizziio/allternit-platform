import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePipedreamCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePipedreamCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
