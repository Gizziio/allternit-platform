import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { googleJsonRequest } from "../googledrive/runtime-shared.ts";
import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { youtubeActionHandlers } from "./runtime.ts";

const service = "youtube";
const googleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, youtubeActionHandlers);

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher, signal }) {
    const profile = await googleJsonRequest<{ email?: string; name?: string; sub?: string }>(googleUserInfoUrl, {
      accessToken: input.accessToken,
      fetcher,
      signal,
    });
    return {
      profile: {
        accountId: profile.email ?? profile.sub ?? "youtube:oauth2",
        displayName: profile.name ?? profile.email ?? "YouTube User",
      },
      metadata: {
        currentAccount: profile,
      },
    };
  },
};
