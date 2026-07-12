import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tripleWhaleActionHandlers, validateTripleWhaleCredential } from "./runtime.ts";

const service = "triple_whale";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tripleWhaleActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateTripleWhaleCredential(input.apiKey, fetcher, signal);
  },
};
