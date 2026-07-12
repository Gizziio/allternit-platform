import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePaymoCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validatePaymoCredential({ apiKey: input.apiKey, ...input.values }, fetcher, signal);
  },
};
