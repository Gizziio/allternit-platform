import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { htmlToImageActionHandlers, validateHtmlToImageCredential } from "./runtime.ts";

const service = "html_to_image";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, htmlToImageActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHtmlToImageCredential,
};
