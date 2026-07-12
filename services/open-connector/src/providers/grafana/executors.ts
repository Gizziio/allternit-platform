import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { GrafanaContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { grafanaActionHandlers, normalizeGrafanaBaseUrl, validateGrafanaCredential } from "./runtime.ts";

const service = "grafana";

export const executors: ProviderExecutors = defineProviderExecutors<GrafanaContext>({
  service,
  handlers: grafanaActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<GrafanaContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      baseUrl: normalizeGrafanaBaseUrl(
        optionalString(credential.values.baseUrl) ?? optionalString(credential.metadata.baseUrl),
      ),
      apiKey: credential.apiKey,
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "grafana request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateGrafanaCredential(input.apiKey, input.values, fetcher, signal);
  },
};
