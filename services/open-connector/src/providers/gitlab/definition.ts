import type { ProviderDefinition } from "../../core/types.ts";

import { gitlabActions } from "./actions.ts";

const service = "gitlab";

/**
 * GitLab provider backed by the GitLab REST API.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "GitLab",
  categories: ["Developer Tools"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Personal access token",
      placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
      description:
        "GitLab personal access token sent with the PRIVATE-TOKEN header. Create one in GitLab user preferences under Access tokens.",
    },
  ],
  homepageUrl: "https://gitlab.com",
  actions: gitlabActions,
};
