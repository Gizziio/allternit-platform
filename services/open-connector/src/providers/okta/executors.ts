import type {
  CredentialValidationResult,
  CredentialValidators,
  ExecutionContext,
  ProviderExecutors,
  ProviderProxyExecutor,
} from "../../core/types.ts";
import type { OktaContext } from "./runtime.ts";

import { optionalString, requiredString } from "../../core/cast.ts";
import {
  defineProviderExecutors,
  defineProviderProxy,
  providerUserAgent,
  ProviderRequestError,
  requireCustomCredential,
} from "../provider-runtime.ts";
import { normalizeOktaOrgUrl, oktaActionHandlers, validateOktaCredential } from "./runtime.ts";

const service = "okta";

export const executors: ProviderExecutors = defineProviderExecutors<OktaContext>({
  service,
  handlers: oktaActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<OktaContext> {
    const credential = await requireCustomCredential(context, service);
    return {
      orgUrl: normalizeOktaOrgUrl(optionalString(credential.metadata.orgUrl) ?? credential.values.orgUrl),
      apiToken: requiredString(credential.values.apiToken, "apiToken", providerInputError),
      fetcher,
      signal: context.signal,
    };
  },
});

export const proxy: ProviderProxyExecutor = defineProviderProxy({
  service,
  baseUrl: async (context) => {
    const credential = await requireCustomCredential(context, service);
    return normalizeOktaOrgUrl(optionalString(credential.metadata.orgUrl) ?? credential.values.orgUrl);
  },
  auth: { type: "none" },
  async customizeRequest({ context, headers }) {
    const credential = await requireCustomCredential(context, service);
    const apiToken = requiredString(credential.values.apiToken, "apiToken", providerInputError);
    headers.set("accept", "application/json");
    headers.set("authorization", `SSWS ${apiToken}`);
    headers.set("user-agent", providerUserAgent);
  },
});

export const credentialValidators: CredentialValidators = {
  customCredential(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateOktaCredential(input.values, fetcher, signal);
  },
};

function providerInputError(message: string): ProviderRequestError {
  return new ProviderRequestError(400, message);
}
