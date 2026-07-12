import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { MapleBillingActionContext } from "./runtime.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { mapleBillingActionHandlers, validateMapleBillingCredential } from "./runtime.ts";

const service = "maple_billing";

export const executors: ProviderExecutors = defineProviderExecutors<MapleBillingActionContext>({
  service,
  handlers: mapleBillingActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<MapleBillingActionContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      companyId: String(credential.metadata.companyId ?? credential.values.companyId ?? ""),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey: validateMapleBillingCredential,
};
