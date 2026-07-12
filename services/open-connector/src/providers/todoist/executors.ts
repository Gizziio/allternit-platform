import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineBearerProviderExecutors } from "../provider-runtime.ts";
import { fetchTodoistCurrentAccount, todoistActionHandlers, validateTodoistCredential } from "./runtime.ts";

const service = "todoist";

export const executors: ProviderExecutors = defineBearerProviderExecutors(service, todoistActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTodoistCredential(input.apiKey, fetcher, signal);
  },
  oauth2(input, { fetcher, signal }) {
    return fetchTodoistCurrentAccount(input.accessToken, fetcher, signal);
  },
};
