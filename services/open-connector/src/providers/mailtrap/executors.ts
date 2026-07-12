import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import {
  mailtrapActionHandlers,
  readAccessibleMailtrapAccountIds,
  readMailtrapAccountId,
  validateMailtrapCredential,
} from "./runtime.ts";

const service = "mailtrap";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: mailtrapActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch) {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      accountId: readMailtrapAccountId({
        ...credential.metadata,
        ...credential.values,
      }),
      accessibleAccountIds: readAccessibleMailtrapAccountIds(credential.metadata),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateMailtrapCredential(
      {
        apiKey: input.apiKey,
        accountId: input.values.accountId,
      },
      fetcher,
      signal,
    );
  },
};
