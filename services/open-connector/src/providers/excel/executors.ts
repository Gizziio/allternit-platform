import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { OAuthProviderContext } from "../provider-runtime.ts";

import { optionalString, requiredString } from "../../core/cast.ts";
import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { excelActions } from "./actions.ts";
import { excelJsonRequest, executeExcelAction } from "./runtime.ts";

const service = "excel";

type ExcelActionHandler = (input: Record<string, unknown>, context: OAuthProviderContext) => Promise<unknown>;

export const excelActionHandlers: Record<string, ExcelActionHandler> = Object.fromEntries(
  excelActions.map((action) => [
    action.name,
    (input: Record<string, unknown>, context: OAuthProviderContext) =>
      executeExcelAction(
        {
          actionName: action.name as string,
          input,
          accessToken: context.accessToken,
        },
        context.fetcher,
      ),
  ]),
) as Record<string, ExcelActionHandler>;

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, excelActionHandlers);

export const credentialValidators: CredentialValidators = {
  async oauth2(input, { fetcher }) {
    const profile = await excelJsonRequest<{
      id?: unknown;
      displayName?: unknown;
      mail?: unknown;
      userPrincipalName?: unknown;
    }>("me", {
      accessToken: input.accessToken,
      fetcher,
      query: {
        $select: ["id", "displayName", "mail", "userPrincipalName"].join(","),
      },
    });
    const accountId = requiredString(profile.id, "excel current account id");
    const displayName = optionalString(profile.displayName);
    const mail = optionalString(profile.mail);
    const userPrincipalName = optionalString(profile.userPrincipalName);
    return {
      profile: {
        accountId,
        displayName: mail ?? userPrincipalName ?? displayName ?? accountId,
      },
      metadata: {
        currentAccount: profile,
      },
    };
  },
};
