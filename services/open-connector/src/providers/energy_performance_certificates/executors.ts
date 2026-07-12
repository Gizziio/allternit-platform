import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import {
  energyPerformanceCertificatesActionHandlers,
  validateEnergyPerformanceCertificatesCredential,
} from "./runtime.ts";

const service = "energy_performance_certificates";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(
  service,
  energyPerformanceCertificatesActionHandlers,
);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEnergyPerformanceCertificatesCredential(input.apiKey, fetcher, signal);
  },
};
