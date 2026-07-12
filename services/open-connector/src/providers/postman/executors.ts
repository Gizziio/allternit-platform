import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";
import type { PostmanActionName } from "./actions.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { postmanActions } from "./actions.ts";
import { executePostmanAction, validatePostmanCredential } from "./runtime.ts";

const service = "postman";

type PostmanActionContext = ApiKeyProviderContext;

type PostmanActionHandler = (input: Record<string, unknown>, context: PostmanActionContext) => Promise<unknown>;

export const postmanActionHandlers: Record<PostmanActionName, PostmanActionHandler> = Object.fromEntries(
  postmanActions.map((action) => [
    action.name,
    (input: Record<string, unknown>, context: PostmanActionContext) =>
      executePostmanAction(action.name as PostmanActionName, input, context),
  ]),
) as Record<PostmanActionName, PostmanActionHandler>;

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, postmanActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validatePostmanCredential(input.apiKey, fetcher);
  },
};
