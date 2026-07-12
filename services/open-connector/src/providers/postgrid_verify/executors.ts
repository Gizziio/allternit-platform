import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePostgridVerifyCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validatePostgridVerifyCredential({ apiKey: input.apiKey, ...input.values }, fetcher, signal);
  },
};
