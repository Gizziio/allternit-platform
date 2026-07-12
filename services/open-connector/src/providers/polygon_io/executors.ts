import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePolygonIoCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePolygonIoCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
