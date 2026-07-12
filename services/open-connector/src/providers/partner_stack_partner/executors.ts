import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePartnerStackPartnerCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePartnerStackPartnerCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
