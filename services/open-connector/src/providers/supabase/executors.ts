import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineBearerProviderExecutors } from "../provider-runtime.ts";
import { supabaseActionHandlers, validateSupabaseCredential } from "./runtime.ts";

const service = "supabase";

export const executors: ProviderExecutors = defineBearerProviderExecutors(service, supabaseActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateSupabaseCredential(input.apiKey, fetcher);
  },
  async oauth2(input, { fetcher }) {
    return validateSupabaseCredential(input.accessToken, fetcher);
  },
};
