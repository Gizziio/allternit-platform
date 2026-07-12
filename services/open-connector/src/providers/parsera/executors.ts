import type { CredentialValidators } from "../../core/types.ts";

import { executors, validateParseraCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateParseraCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
