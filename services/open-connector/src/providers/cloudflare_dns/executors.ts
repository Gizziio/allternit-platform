import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineBearerProviderExecutors, ProviderRequestError } from "../provider-runtime.ts";
import { cloudflareDnsActionHandlers, requestCloudflareAccounts, validateCloudflareDnsToken } from "./runtime.ts";

const service = "cloudflare_dns";

export const executors: ProviderExecutors = defineBearerProviderExecutors(service, cloudflareDnsActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateCloudflareDnsToken(input.apiKey, fetcher, signal);
  },
  async oauth2(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    const result = await requestCloudflareAccounts(input.accessToken, fetcher, signal, { page: 1, perPage: 1 });
    const firstAccount = result.accounts[0];
    return {
      profile: {
        accountId: firstAccount?.id ?? input.profile.accountId,
        displayName: firstAccount?.name ?? input.profile.displayName,
      },
      grantedScopes: input.profile.grantedScopes,
      metadata: {
        accountId: firstAccount?.id,
        accountName: firstAccount?.name,
        validationEndpoint: "/accounts?page=1&per_page=1",
      },
    };
  },
};

export function createCloudflareDnsCredentialError(message: string): ProviderRequestError {
  return new ProviderRequestError(400, message);
}
