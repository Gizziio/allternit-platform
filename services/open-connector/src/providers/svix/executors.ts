import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { getSvixBaseUrl, svixActionHandlers, validateSvixCredential } from "./runtime.ts";

const service = "svix";

export const executors: ProviderExecutors = defineProviderExecutors({
  service,
  handlers: svixActionHandlers,
  async createContext(context, fetcher) {
    const credential = await requireApiKeyCredential(context, service);
    const serverUrl = readString(credential.metadata.serverUrl) ?? readString(credential.values.serverUrl);
    return {
      apiKey: credential.apiKey,
      baseUrl: getSvixBaseUrl({ apiKey: credential.apiKey, serverUrl }),
      fetcher,
      signal: context.signal,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSvixCredential(
      {
        apiKey: input.apiKey,
        serverUrl: input.values.serverUrl,
      },
      fetcher,
      signal,
    );
  },
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
