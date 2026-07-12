import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { screenshotoneActionHandlers, validateScreenshotoneApiKey } from "./runtime.ts";

const service = "screenshotone";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, screenshotoneActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateScreenshotoneApiKey(input.apiKey, fetcher, signal);
  },
};
