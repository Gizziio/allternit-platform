import type { ActionDefinition, JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "gitea";

const pageField = s.positiveInteger("Page number of results to return.");
const limitField = s.positiveInteger("Maximum number of results to return.");
const repositoryOwnerField = s.nonEmptyString("Owner of the repository.");
const repositoryNameField = s.nonEmptyString("Name of the repository.");
const issueNumberField = s.positiveInteger("Issue number within the repository.");
const isoDateTimeField = s.string("Timestamp in ISO 8601 / RFC 3339 format.");
const looseObjectSchema = s.looseObject("A Gitea API object.");

const giteaUserSchema = s.looseObject(
  {
    id: s.integer("Numeric user ID."),
    login: s.string("Username of the Gitea account."),
    full_name: s.string("Full display name of the user."),
    email: s.string("Email address of the user when visible."),
    avatar_url: s.string("Avatar URL of the user."),
    html_url: s.string("HTML URL of the user profile."),
    language: s.string("Preferred language of the user."),
    location: s.string("Profile location of the user."),
    website: s.string("Website configured on the user profile."),
    description: s.string("Profile description or bio of the user."),
    visibility: s.string("Visibility setting of the user profile."),
    is_admin: s.boolean("Whether the user is a site administrator."),
    restricted: s.boolean("Whether the user account is restricted."),
    active: s.boolean("Whether the user account is active."),
    created: isoDateTimeField,
    last_login: isoDateTimeField,
  },
  { description: "A Gitea user record." },
);

const giteaLabelSchema = s.looseObject(
  {
    id: s.integer("Numeric label ID."),
    name: s.string("Label name."),
    color: s.string("Hex color value configured for the label."),
    description: s.nullableString("Description configured for the label."),
    exclusive: s.boolean("Whether the label is exclusive."),
    is_archived: s.boolean("Whether the label is archived."),
  },
  { description: "A Gitea issue label." },
);

const giteaMilestoneSchema = s.looseObject(
  {
    id: s.integer("Numeric milestone ID."),
    title: s.string("Milestone title."),
    state: s.string("Current milestone state."),
    description: s.nullableString("Milestone description."),
    due_on: s.nullableString("Due date of the milestone."),
    closed_at: s.nullableString("Timestamp when the milestone was closed."),
  },
  { description: "A Gitea milestone." },
);

const giteaRepositoryMetaSchema = s.looseObject(
  {
    id: s.integer("Numeric repository ID."),
    name: s.string("Repository name."),
    owner: s.string("Repository owner name."),
    full_name: s.string("Full repository name including owner."),
  },
  { description: "A compact Gitea repository record." },
);

const giteaRepositorySchema = s.looseObject(
  {
    id: s.integer("Numeric repository ID."),
    name: s.string("Repository name."),
    full_name: s.string("Full repository name including owner."),
    private: s.boolean("Whether the repository is private."),
    html_url: s.string("HTML URL of the repository."),
    clone_url: s.string("HTTPS clone URL of the repository."),
    ssh_url: s.string("SSH clone URL of the repository."),
    description: s.nullableString("Repository description."),
    default_branch: s.string("Default branch of the repository."),
    owner: giteaUserSchema,
    fork: s.boolean("Whether the repository is a fork."),
    mirror: s.boolean("Whether the repository is a mirror."),
    archived: s.boolean("Whether the repository is archived."),
    empty: s.boolean("Whether the repository is empty."),
    has_issues: s.boolean("Whether issues are enabled."),
    has_pull_requests: s.boolean("Whether pull requests are enabled."),
    has_projects: s.boolean("Whether projects are enabled."),
    has_wiki: s.boolean("Whether wiki is enabled."),
    has_actions: s.boolean("Whether actions are enabled."),
    open_issues_count: s.integer("Open issue count."),
    stars_count: s.integer("Star count."),
    watchers_count: s.integer("Watcher count."),
    forks_count: s.integer("Fork count."),
    size: s.integer("Repository size in kilobytes."),
    language: s.string("Primary language of the repository."),
    topics: s.stringArray("Topics configured on the repository.", { itemDescription: "A repository topic." }),
    created_at: isoDateTimeField,
    updated_at: isoDateTimeField,
  },
  { description: "A Gitea repository record." },
);

const giteaIssueSchema = s.looseObject(
  {
    id: s.integer("Numeric issue ID."),
    number: s.integer("Issue number within the repository."),
    title: s.string("Issue title."),
    body: s.nullableString("Issue body."),
    state: s.string("Issue state."),
    html_url: s.string("HTML URL of the issue."),
    url: s.string("API URL of the issue."),
    comments: s.integer("Number of comments on the issue."),
    created_at: isoDateTimeField,
    updated_at: isoDateTimeField,
    closed_at: s.nullableString("Timestamp when the issue was closed."),
    due_date: s.nullableString("Issue due date."),
    ref: s.nullableString("Git reference associated with the issue."),
    is_locked: s.boolean("Whether the issue is locked."),
    user: giteaUserSchema,
    assignee: s.nullable(giteaUserSchema),
    assignees: s.array("Assignees of the issue.", giteaUserSchema),
    labels: s.array("Labels attached to the issue.", giteaLabelSchema),
    milestone: s.nullable(giteaMilestoneSchema),
    repository: giteaRepositoryMetaSchema,
    pull_request: looseObjectSchema,
  },
  { description: "A Gitea issue record." },
);

const giteaCommentSchema = s.looseObject(
  {
    id: s.integer("Numeric comment ID."),
    body: s.string("Comment body."),
    html_url: s.string("HTML URL of the comment."),
    issue_url: s.string("API URL of the parent issue."),
    pull_request_url: s.nullableString("API URL of the related pull request."),
    created_at: isoDateTimeField,
    updated_at: isoDateTimeField,
    user: giteaUserSchema,
    assets: s.array("Attachments included with the comment.", looseObjectSchema),
  },
  { description: "A Gitea issue comment." },
);

const repositoriesListSchema = s.actionOutput(
  {
    repositories: s.array("Repositories returned by the request.", giteaRepositorySchema),
    total_count: s.integer("Total number of matching repositories from the x-total-count header when available."),
  },
  "A paginated list of Gitea repositories.",
  ["repositories"],
);

const repositorySearchSchema = s.actionOutput(
  {
    ok: s.boolean("Whether the search request succeeded."),
    repositories: s.array("Repositories returned by the search.", giteaRepositorySchema),
    total_count: s.integer("Total number of matching repositories from the x-total-count header when available."),
  },
  "A Gitea repository search response.",
  ["ok", "repositories"],
);

const issuesListSchema = s.actionOutput(
  {
    issues: s.array("Issues returned by the request.", giteaIssueSchema),
    total_count: s.integer("Total number of matching issues from the x-total-count header when available."),
  },
  "A paginated list of Gitea issues.",
  ["issues"],
);

const commentsListSchema = s.actionOutput(
  {
    comments: s.array("Comments returned by the request.", giteaCommentSchema),
    total_count: s.integer("Total number of matching comments from the x-total-count header when available."),
  },
  "A list of Gitea issue comments.",
  ["comments"],
);

function repositoryInput(
  description: string,
  extra: Record<string, JsonSchema> = {},
  optional: string[] = [],
): JsonSchema {
  return s.object(
    description,
    {
      owner: repositoryOwnerField,
      repo: repositoryNameField,
      ...extra,
    },
    { optional },
  );
}

export const giteaActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "get_current_user",
    description: "Get the current authenticated Gitea user profile.",
    requiredScopes: [],
    inputSchema: s.object("The input payload for this action.", {}),
    outputSchema: giteaUserSchema,
    followUpActions: ["gitea.list_my_repositories"],
  }),
  defineProviderAction(service, {
    name: "list_my_repositories",
    description: "List repositories owned by the authenticated Gitea user.",
    requiredScopes: [],
    inputSchema: s.object(
      "The input payload for this action.",
      {
        page: pageField,
        limit: limitField,
      },
      { optional: ["page", "limit"] },
    ),
    outputSchema: repositoriesListSchema,
    followUpActions: ["gitea.get_repository"],
  }),
  defineProviderAction(service, {
    name: "get_repository",
    description: "Get metadata for a Gitea repository by owner and name.",
    requiredScopes: [],
    inputSchema: repositoryInput("The input payload for this action."),
    outputSchema: giteaRepositorySchema,
    followUpActions: ["gitea.list_repository_issues"],
  }),
  defineProviderAction(service, {
    name: "search_repositories",
    description: "Search Gitea repositories by keyword with optional repository filters.",
    requiredScopes: [],
    inputSchema: s.object(
      "The input payload for this action.",
      {
        query: s.nonEmptyString("Keyword used to search repositories."),
        topic: s.boolean("Whether to limit the keyword search to repository topics."),
        includeDescription: s.boolean("Whether the keyword should also search repository descriptions."),
        ownerId: s.positiveInteger("Only search repositories owned by or contributed to by this user ID."),
        priorityOwnerId: s.positiveInteger("Repository owner ID to prioritize in the results."),
        teamId: s.positiveInteger("Only search repositories that belong to this team ID."),
        starredByUserId: s.positiveInteger("Only search repositories starred by this user ID."),
        private: s.boolean("Whether private repositories accessible to the token should be included."),
        template: s.boolean("Whether template repositories accessible to the token should be included."),
        archived: s.boolean("Whether archived repositories should be included."),
        mode: s.stringEnum("Repository mode filter.", ["fork", "source", "mirror", "collaborative"]),
        exclusive: s.boolean("When ownerId is set, whether to restrict results to repositories the user owns."),
        sort: s.stringEnum("Sort field used by the repository search endpoint.", [
          "alpha",
          "created",
          "updated",
          "size",
          "git_size",
          "lfs_size",
          "stars",
          "forks",
          "id",
        ]),
        order: s.stringEnum("Sort order.", ["asc", "desc"]),
        page: pageField,
        limit: limitField,
      },
      {
        optional: [
          "topic",
          "includeDescription",
          "ownerId",
          "priorityOwnerId",
          "teamId",
          "starredByUserId",
          "private",
          "template",
          "archived",
          "mode",
          "exclusive",
          "sort",
          "order",
          "page",
          "limit",
        ],
      },
    ),
    outputSchema: repositorySearchSchema,
    followUpActions: ["gitea.get_repository"],
  }),
  defineProviderAction(service, {
    name: "list_repository_issues",
    description: "List issues in a Gitea repository. Pull requests are filtered out.",
    requiredScopes: [],
    inputSchema: repositoryInput(
      "The input payload for this action.",
      {
        state: s.stringEnum("Issue state filter.", ["open", "closed", "all"]),
        labels: s.array(
          "Label names or IDs used to filter issues.",
          s.union([s.nonEmptyString("A label name or ID."), s.integer("A label name or ID.")]),
        ),
        query: s.nonEmptyString("Search string used to filter issues."),
        milestones: s.array(
          "Milestone names or IDs used to filter issues.",
          s.union([s.nonEmptyString("A milestone name or ID."), s.integer("A milestone name or ID.")]),
        ),
        since: isoDateTimeField,
        before: isoDateTimeField,
        createdBy: s.nonEmptyString("Only return issues created by this username."),
        assignedBy: s.nonEmptyString("Only return issues assigned to this username."),
        mentionedBy: s.nonEmptyString("Only return issues mentioning this username."),
        page: pageField,
        limit: limitField,
      },
      [
        "state",
        "labels",
        "query",
        "milestones",
        "since",
        "before",
        "createdBy",
        "assignedBy",
        "mentionedBy",
        "page",
        "limit",
      ],
    ),
    outputSchema: issuesListSchema,
    followUpActions: ["gitea.get_issue", "gitea.create_issue"],
  }),
  defineProviderAction(service, {
    name: "get_issue",
    description: "Get a Gitea issue by repository and issue number.",
    requiredScopes: [],
    inputSchema: repositoryInput("The input payload for this action.", {
      issueNumber: issueNumberField,
    }),
    outputSchema: giteaIssueSchema,
    followUpActions: ["gitea.list_issue_comments", "gitea.create_issue_comment"],
  }),
  defineProviderAction(service, {
    name: "create_issue",
    description: "Create an issue in a Gitea repository.",
    requiredScopes: [],
    inputSchema: repositoryInput(
      "The input payload for this action.",
      {
        title: s.nonEmptyString("Title of the issue."),
        body: s.string("Body of the issue."),
        assignees: s.stringArray("Usernames to assign to the issue.", { itemDescription: "An assignee username." }),
        labelIds: s.array("Label IDs to attach to the issue.", s.positiveInteger("A label ID.")),
        milestoneId: s.positiveInteger("Milestone ID to attach to the issue."),
        ref: s.nonEmptyString("Git reference associated with the issue."),
        dueDate: s.nonEmptyString("Issue deadline in RFC 3339 format. Gitea only uses the date component."),
        closed: s.boolean("Whether the issue should be created in the closed state."),
      },
      ["body", "assignees", "labelIds", "milestoneId", "ref", "dueDate", "closed"],
    ),
    outputSchema: giteaIssueSchema,
    followUpActions: ["gitea.create_issue_comment"],
  }),
  defineProviderAction(service, {
    name: "list_issue_comments",
    description: "List comments under a Gitea issue.",
    requiredScopes: [],
    inputSchema: repositoryInput(
      "The input payload for this action.",
      {
        issueNumber: issueNumberField,
        since: isoDateTimeField,
        before: isoDateTimeField,
      },
      ["since", "before"],
    ),
    outputSchema: commentsListSchema,
    followUpActions: ["gitea.create_issue_comment"],
  }),
  defineProviderAction(service, {
    name: "create_issue_comment",
    description: "Create a comment on a Gitea issue.",
    requiredScopes: [],
    inputSchema: repositoryInput("The input payload for this action.", {
      issueNumber: issueNumberField,
      body: s.nonEmptyString("Comment body."),
    }),
    outputSchema: giteaCommentSchema,
  }),
];

export type GiteaActionName =
  | "get_current_user"
  | "list_my_repositories"
  | "get_repository"
  | "search_repositories"
  | "list_repository_issues"
  | "get_issue"
  | "create_issue"
  | "list_issue_comments"
  | "create_issue_comment";
