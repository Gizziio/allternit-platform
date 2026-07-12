import type { CredentialValidators } from "../../core/types.ts";

import { executors, validatePlaterecognizerCredential } from "./runtime.ts";

export { executors };

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validatePlaterecognizerCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
