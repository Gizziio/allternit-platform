import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ApiKeyProviderContext } from "../provider-runtime.ts";

import {
  compactObject,
  objectArray,
  optionalBoolean,
  optionalRecord,
  optionalString,
  requiredRecord,
  requiredString,
} from "../../core/cast.ts";
import {
  defineProviderExecutors,
  ProviderRequestError,
  providerUserAgent,
  requireApiKeyCredential,
  setSearchParams,
} from "../provider-runtime.ts";

const service = "asana";
const asanaApiBaseUrl = "https://app.asana.com/api/1.0";
const asanaValidationPath = "/users/me";

type AsanaRequestPhase = "validate" | "execute";
type AsanaActionHandler = (input: Record<string, unknown>, context: ApiKeyProviderContext) => Promise<unknown>;

interface AsanaRequestOptions {
  context: Pick<ApiKeyProviderContext, "apiKey" | "fetcher" | "signal">;
  path: string;
  phase: AsanaRequestPhase;
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  notFoundAsInvalidInput?: boolean;
}

const defaultWorkspaceFields = ["name", "email_domains", "is_organization"];
const defaultProjectFields = [
  "name",
  "archived",
  "color",
  "icon",
  "notes",
  "due_on",
  "start_on",
  "default_view",
  "privacy_setting",
  "default_access_level",
  "created_at",
  "modified_at",
  "owner",
  "owner.name",
  "workspace",
  "workspace.name",
  "permalink_url",
];
const defaultTaskFields = [
  "name",
  "resource_subtype",
  "completed",
  "completed_at",
  "created_at",
  "modified_at",
  "notes",
  "due_on",
  "due_at",
  "start_on",
  "start_at",
  "approval_status",
  "assignee",
  "assignee.name",
  "workspace",
  "workspace.name",
  "projects",
  "projects.name",
  "permalink_url",
];

export const asanaActionHandlers: Record<string, AsanaActionHandler> = {
  list_workspaces(input, context) {
    return listEntities("/workspaces", buildPaginationQuery(input, defaultWorkspaceFields), "workspaces", context);
  },

  get_workspace(input, context) {
    return getEntity(
      `/workspaces/${encodeURIComponent(requiredString(input.workspaceId, "workspaceId", invalidInputError))}`,
      {
        opt_fields: joinOptFields(mergeFields(defaultWorkspaceFields, readStringArray(input.includeFields))),
      },
      "workspace",
      context,
    );
  },

  list_projects(input, context) {
    return listEntities(
      "/projects",
      compactStringObject({
        workspace: requiredString(input.workspaceId, "workspaceId", invalidInputError),
        archived: booleanToString(input.archived),
        ...buildPaginationQuery(input, defaultProjectFields),
      }),
      "projects",
      context,
    );
  },

  get_project(input, context) {
    return getEntity(
      `/projects/${encodeURIComponent(requiredString(input.projectId, "projectId", invalidInputError))}`,
      {
        opt_fields: joinOptFields(mergeFields(defaultProjectFields, readStringArray(input.includeFields))),
      },
      "project",
      context,
    );
  },

  create_project(input, context) {
    return writeEntity("/projects", buildCreateProjectBody(input), "project", context, "POST");
  },

  update_project(input, context) {
    return writeEntity(
      `/projects/${encodeURIComponent(requiredString(input.projectId, "projectId", invalidInputError))}`,
      buildUpdateProjectBody(input),
      "project",
      context,
      "PUT",
      true,
    );
  },

  list_project_tasks(input, context) {
    return listEntities(
      `/projects/${encodeURIComponent(requiredString(input.projectId, "projectId", invalidInputError))}/tasks`,
      compactStringObject({
        completed_since: optionalString(input.completedSince),
        ...buildPaginationQuery(input, defaultTaskFields),
      }),
      "tasks",
      context,
    );
  },

  get_task(input, context) {
    return getEntity(
      `/tasks/${encodeURIComponent(requiredString(input.taskId, "taskId", invalidInputError))}`,
      {
        opt_fields: joinOptFields(mergeFields(defaultTaskFields, readStringArray(input.includeFields))),
      },
      "task",
      context,
    );
  },

  create_task(input, context) {
    return writeEntity("/tasks", buildCreateTaskBody(input), "task", context, "POST");
  },

  update_task(input, context) {
    return writeEntity(
      `/tasks/${encodeURIComponent(requiredString(input.taskId, "taskId", invalidInputError))}`,
      buildUpdateTaskBody(input),
      "task",
      context,
      "PUT",
      true,
    );
  },
};

export const executors: ProviderExecutors = defineProviderExecutors<ApiKeyProviderContext>({
  service,
  handlers: asanaActionHandlers,
  async createContext(context, fetcher): Promise<ApiKeyProviderContext> {
    const credential = await requireApiKeyCredential(context, service);
    return {
      apiKey: credential.apiKey,
      fetcher,
      signal: context.signal,
      transitFiles: context.transitFiles,
    };
  },
});

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    const payload = await requestAsanaJson({
      path: asanaValidationPath,
      context: {
        apiKey: input.apiKey,
        fetcher,
        signal,
      },
      phase: "validate",
      query: {
        opt_fields: joinOptFields(["name", "email", "workspaces", "workspaces.name"]),
      },
    });

    const user = readDataObject(payload, "user");
    const userId = optionalString(user.gid);
    const name = optionalString(user.name);
    const email = optionalString(user.email);
    const workspaces = Array.isArray(user.workspaces)
      ? user.workspaces.map((workspace) => optionalRecord(workspace)).filter((workspace) => !!workspace)
      : [];
    const workspaceNames = workspaces
      .map((workspace) => optionalString(workspace.name))
      .filter((workspaceName) => !!workspaceName);

    return {
      profile: {
        accountId: userId,
        displayName: name ?? email ?? "Asana PAT",
      },
      grantedScopes: [],
      metadata: compactObject({
        apiBaseUrl: asanaApiBaseUrl,
        validationEndpoint: asanaValidationPath,
        userId,
        name,
        email,
        workspaceCount: workspaces.length,
        workspaceNames,
      }),
    };
  },
};

async function listEntities(
  path: string,
  query: Record<string, string | undefined>,
  outputKey: string,
  context: ApiKeyProviderContext,
): Promise<Record<string, unknown>> {
  const payload = await requestAsanaJson({
    path,
    context,
    phase: "execute",
    query,
  });

  return {
    [outputKey]: readDataArray(payload),
    nextCursor: readNextCursor(payload),
  };
}

async function getEntity(
  path: string,
  query: Record<string, string | undefined>,
  outputKey: string,
  context: ApiKeyProviderContext,
): Promise<Record<string, unknown>> {
  const payload = await requestAsanaJson({
    path,
    context,
    phase: "execute",
    query,
    notFoundAsInvalidInput: true,
  });

  return {
    [outputKey]: readDataObject(payload, outputKey),
  };
}

async function writeEntity(
  path: string,
  body: Record<string, unknown>,
  outputKey: string,
  context: ApiKeyProviderContext,
  method: "POST" | "PUT",
  notFoundAsInvalidInput = false,
): Promise<Record<string, unknown>> {
  const payload = await requestAsanaJson({
    path,
    context,
    phase: "execute",
    method,
    body,
    notFoundAsInvalidInput,
  });

  return {
    [outputKey]: readDataObject(payload, outputKey),
  };
}

async function requestAsanaJson(input: AsanaRequestOptions): Promise<Record<string, unknown>> {
  const url = new URL(`${asanaApiBaseUrl}${input.path}`);
  setSearchParams(url, input.query ?? {});

  let response: Response;
  try {
    response = await input.context.fetcher(url, {
      method: input.method ?? "GET",
      headers: compactHeaders({
        accept: "application/json",
        authorization: `Bearer ${input.context.apiKey}`,
        "content-type": input.body ? "application/json" : undefined,
        "user-agent": providerUserAgent,
      }),
      body: input.body ? JSON.stringify({ data: input.body }) : undefined,
      signal: input.context.signal,
    });
  } catch (error) {
    throw new ProviderRequestError(
      isAbortError(error) ? 504 : 502,
      error instanceof Error ? `Asana request failed: ${error.message}` : "Asana request failed",
    );
  }

  const payload = await readAsanaPayload(response);
  if (!response.ok) {
    throw createAsanaError(response, payload, input.phase, input.notFoundAsInvalidInput ?? false);
  }

  return payload;
}

async function readAsanaPayload(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 204) {
    return {};
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new ProviderRequestError(502, text || "Asana response is not JSON");
  }

  return requiredRecord(await response.json(), "asana response", (message) => new ProviderRequestError(502, message));
}

function createAsanaError(
  response: Response,
  payload: Record<string, unknown>,
  phase: AsanaRequestPhase,
  notFoundAsInvalidInput: boolean,
): ProviderRequestError {
  const message = readErrorMessage(payload) ?? `Asana request failed with status ${response.status}`;

  if (response.status === 400) {
    return new ProviderRequestError(400, message, payload);
  }
  if (response.status === 401) {
    return new ProviderRequestError(phase === "validate" ? 400 : 401, message, payload);
  }
  if (response.status === 404 && notFoundAsInvalidInput) {
    return new ProviderRequestError(400, message, payload);
  }
  if (response.status === 429) {
    return new ProviderRequestError(429, message, payload);
  }

  return new ProviderRequestError(response.status || 500, message, payload);
}

function readErrorMessage(payload: Record<string, unknown>): string | undefined {
  const errors = payload.errors;
  if (!Array.isArray(errors)) {
    return undefined;
  }

  for (const error of errors) {
    const message = optionalString(optionalRecord(error)?.message);
    if (message) {
      return message;
    }
  }

  return undefined;
}

function readDataArray(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  return objectArray(payload.data, "asana response data", (message) => new ProviderRequestError(502, message));
}

function readDataObject(payload: Record<string, unknown>, label: string): Record<string, unknown> {
  return requiredRecord(payload.data, `asana ${label} response`, (message) => new ProviderRequestError(502, message));
}

function readNextCursor(payload: Record<string, unknown>): string | null {
  return optionalString(optionalRecord(payload.next_page)?.offset) ?? null;
}

function buildPaginationQuery(input: Record<string, unknown>, defaultFields: string[]): Record<string, string> {
  return compactStringObject({
    limit: numberToString(input.limit),
    offset: optionalString(input.cursor),
    opt_fields: joinOptFields(mergeFields(defaultFields, readStringArray(input.includeFields))),
  });
}

function buildCreateProjectBody(input: Record<string, unknown>): Record<string, unknown> {
  assertProjectDateRange(input);
  return compactObject({
    workspace: requiredString(input.workspaceId, "workspaceId", invalidInputError),
    name: requiredString(input.name, "name", invalidInputError),
    notes: optionalString(input.notes),
    owner: optionalString(input.owner),
    due_on: optionalString(input.dueOn),
    start_on: optionalString(input.startOn),
    privacy_setting: optionalString(input.privacySetting),
    default_view: optionalString(input.defaultView),
    default_access_level: optionalString(input.defaultAccessLevel),
    color: optionalString(input.color),
    icon: optionalString(input.icon),
    custom_fields: optionalRecord(input.customFields),
    archived: optionalBoolean(input.archived),
  });
}

function buildUpdateProjectBody(input: Record<string, unknown>): Record<string, unknown> {
  assertProjectDateRange(input);
  const body = compactObject({
    name: optionalString(input.name),
    notes: optionalString(input.notes),
    owner: optionalString(input.owner),
    due_on: optionalString(input.dueOn),
    start_on: optionalString(input.startOn),
    privacy_setting: optionalString(input.privacySetting),
    default_view: optionalString(input.defaultView),
    default_access_level: optionalString(input.defaultAccessLevel),
    color: optionalString(input.color),
    icon: optionalString(input.icon),
    custom_fields: optionalRecord(input.customFields),
    archived: optionalBoolean(input.archived),
  });
  requireNonEmptyBody(body, "At least one project field must be provided.");
  return body;
}

function buildCreateTaskBody(input: Record<string, unknown>): Record<string, unknown> {
  assertTaskDateRange(input);
  return compactObject({
    name: requiredString(input.name, "name", invalidInputError),
    notes: optionalString(input.notes),
    assignee: optionalString(input.assignee),
    completed: optionalBoolean(input.completed),
    due_on: optionalString(input.dueOn),
    due_at: optionalString(input.dueAt),
    start_on: optionalString(input.startOn),
    start_at: optionalString(input.startAt),
    approval_status: optionalString(input.approvalStatus),
    resource_subtype: optionalString(input.resourceSubtype),
    custom_fields: optionalRecord(input.customFields),
    projects: [requiredString(input.projectId, "projectId", invalidInputError)],
  });
}

function buildUpdateTaskBody(input: Record<string, unknown>): Record<string, unknown> {
  assertTaskDateRange(input);
  const body = compactObject({
    name: optionalString(input.name),
    notes: optionalString(input.notes),
    assignee: optionalString(input.assignee),
    completed: optionalBoolean(input.completed),
    due_on: optionalString(input.dueOn),
    due_at: optionalString(input.dueAt),
    start_on: optionalString(input.startOn),
    start_at: optionalString(input.startAt),
    approval_status: optionalString(input.approvalStatus),
    resource_subtype: optionalString(input.resourceSubtype),
    custom_fields: optionalRecord(input.customFields),
  });
  requireNonEmptyBody(body, "At least one task field must be provided.");
  return body;
}

function assertProjectDateRange(input: Record<string, unknown>): void {
  if (optionalString(input.startOn) && !optionalString(input.dueOn)) {
    throw new ProviderRequestError(400, "startOn requires dueOn.");
  }
}

function assertTaskDateRange(input: Record<string, unknown>): void {
  const dueOn = optionalString(input.dueOn);
  const dueAt = optionalString(input.dueAt);
  const startOn = optionalString(input.startOn);
  const startAt = optionalString(input.startAt);

  if (dueOn && dueAt) {
    throw new ProviderRequestError(400, "dueOn and dueAt cannot both be provided.");
  }
  if (startOn && startAt) {
    throw new ProviderRequestError(400, "startOn and startAt cannot both be provided.");
  }
  if ((startOn || startAt) && !dueOn && !dueAt) {
    throw new ProviderRequestError(400, "A task start date requires dueOn or dueAt.");
  }
}

function requireNonEmptyBody(body: Record<string, unknown>, message: string): void {
  if (Object.keys(body).length === 0) {
    throw new ProviderRequestError(400, message);
  }
}

function numberToString(value: unknown): string | undefined {
  return typeof value === "number" ? String(value) : undefined;
}

function booleanToString(value: unknown): string | undefined {
  return typeof value === "boolean" ? String(value) : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => optionalString(item)).filter((item): item is string => !!item);
}

function mergeFields(defaultFields: string[], includeFields: string[]): string[] {
  return [...new Set([...defaultFields, ...includeFields])];
}

function joinOptFields(fields: string[]): string {
  return fields.join(",");
}

function compactStringObject(input: Record<string, string | undefined>): Record<string, string> {
  return compactObject(input) as Record<string, string>;
}

function compactHeaders(input: Record<string, string | undefined>): Headers {
  return new Headers(compactObject(input) as Record<string, string>);
}

function invalidInputError(message: string): ProviderRequestError {
  return new ProviderRequestError(400, message);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
