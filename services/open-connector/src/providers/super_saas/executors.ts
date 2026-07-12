import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext, ProviderRuntimeContextFactory } from "../provider-runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { superSaasActionHandlers, validateSuperSaasCredential } from "./runtime.ts";

const service = "super_saas";

interface SuperSaasContext extends ApiKeyProviderContext {
  accountName: string;
}

const createSuperSaasContext: ProviderRuntimeContextFactory<SuperSaasContext> = async (
  context: ExecutionContext,
  fetcher,
) => {
  const credential = await requireApiKeyCredential(context, service);
  return {
    apiKey: credential.apiKey,
    accountName: credential.values.accountName ?? String(credential.metadata.accountName ?? ""),
    fetcher,
    signal: context.signal,
    ...(context.transitFiles ? { transitFiles: context.transitFiles } : {}),
  };
};

export const executors: ProviderExecutors = defineProviderExecutors<SuperSaasContext>({
  service,
  handlers: superSaasActionHandlers,
  createContext: createSuperSaasContext,
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSuperSaasCredential(
      {
        apiKey: input.apiKey,
        accountName: input.values.accountName,
      },
      fetcher,
      signal,
    );
  },
};
