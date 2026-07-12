import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePlacekeyCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePlacekeyCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
