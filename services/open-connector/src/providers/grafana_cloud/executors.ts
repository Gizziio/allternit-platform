import type { CredentialValidators, ExecutionContext, ProviderExecutors } from "../../core/types.ts";
import type { GrafanaCloudContext } from "./runtime.ts";

import { optionalString } from "../../core/cast.ts";
import { defineProviderExecutors, requireApiKeyCredential } from "../provider-runtime.ts";
import { grafanaCloudActionHandlers, requireGrafanaCloudOrgSlug, validateGrafanaCloudCredential } from "./runtime.ts";

const service = "grafana_cloud";

export const executors: ProviderExecutors = defineProviderExecutors<GrafanaCloudContext>({
  service,
  handlers: grafanaCloudActionHandlers,
  async createContext(context: ExecutionContext, fetcher: typeof fetch): Promise<GrafanaCloudContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      orgSlug: requireGrafanaCloudOrgSlug(
        optionalString(credential.values.orgSlug) ?? optionalString(credential.metadata.orgSlug),
      ),
      fetcher,
      signal: context.signal,
    };
  },
  fallbackMessage: "grafana_cloud request failed",
});

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateGrafanaCloudCredential(input.apiKey, input.values, fetcher, signal);
  },
};
