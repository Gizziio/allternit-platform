import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { ticketmasterActionHandlers, validateTicketmasterCredential } from "./runtime.ts";

const service = "ticketmaster";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ticketmasterActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTicketmasterCredential,
};
