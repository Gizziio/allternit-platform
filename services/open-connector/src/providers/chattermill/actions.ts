import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "chattermill";
const raw = s.looseObject("Raw Chattermill object.");
const rawPayload = s.unknown("Raw Chattermill response payload.");
const project = s.nonEmptyString("Chattermill project key or identifier used in the API path.");
const id = s.nonEmptyString("Chattermill resource identifier used in the API path.");
const pageFields = {
  page: s.positiveInteger("Page number to request from Chattermill."),
  perPage: s.positiveInteger("Maximum number of records to return per page."),
};
const projectInput = s.object(
  { project },
  { required: ["project"], description: "Input identifying a Chattermill project." },
);
const projectIdInput = s.object(
  { project, id },
  { required: ["project", "id"], description: "Input identifying a Chattermill project resource." },
);
const listOutput = (key: string): ReturnType<typeof s.object> =>
  s.object({ [key]: s.array(raw, { description: `Chattermill ${key} returned by the API.` }), raw: rawPayload });
const singleOutput = (key: string): ReturnType<typeof s.object> => s.object({ [key]: raw, raw: rawPayload });

export const chattermillActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "list_projects",
    description: "List Chattermill projects accessible to the API key.",
    requiredScopes: [],
    inputSchema: s.object({}, { description: "Input for listing projects." }),
    outputSchema: listOutput("projects"),
  }),
  defineProviderAction(service, {
    name: "get_project",
    description: "Get a Chattermill project by project ID.",
    requiredScopes: [],
    inputSchema: s.object({ id }, { required: ["id"] }),
    outputSchema: singleOutput("project"),
  }),
  defineProviderAction(service, {
    name: "list_responses",
    description: "List responses for a Chattermill project with optional filters.",
    requiredScopes: [],
    inputSchema: s.looseObject(
      { project, ...pageFields },
      { description: "Filters accepted by Chattermill when listing responses." },
    ),
    outputSchema: listOutput("responses"),
  }),
  defineProviderAction(service, {
    name: "get_response",
    description: "Get a single Chattermill response by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("response"),
  }),
  defineProviderAction(service, {
    name: "create_response",
    description: "Create a response in a Chattermill project.",
    requiredScopes: [],
    inputSchema: s.object({ project, response: raw }, { required: ["project", "response"] }),
    outputSchema: singleOutput("response"),
  }),
  defineProviderAction(service, {
    name: "update_response",
    description: "Update user metadata, segments, or other response fields in Chattermill.",
    requiredScopes: [],
    inputSchema: s.object(
      { project, responseId: id, response: raw },
      { required: ["project", "responseId", "response"] },
    ),
    outputSchema: singleOutput("response"),
  }),
  defineProviderAction(service, {
    name: "delete_response",
    description: "Permanently delete a Chattermill response by ID.",
    requiredScopes: [],
    inputSchema: s.object({ project, responseId: id }, { required: ["project", "responseId"] }),
    outputSchema: s.object({
      deleted: s.boolean("Whether the deletion request was sent."),
      responseId: id,
      raw: rawPayload,
    }),
  }),
  defineProviderAction(service, {
    name: "search_responses",
    description: "Search for Chattermill responses by response ID, user metadata, or custom criteria.",
    requiredScopes: [],
    inputSchema: s.looseObject({ project, ...pageFields }, { description: "Search criteria accepted by Chattermill." }),
    outputSchema: listOutput("responses"),
  }),
  defineProviderAction(service, {
    name: "list_data_sources",
    description: "List data sources for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("dataSources"),
  }),
  defineProviderAction(service, {
    name: "get_data_source",
    description: "Get a Chattermill data source by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("dataSource"),
  }),
  defineProviderAction(service, {
    name: "list_data_types",
    description: "List data types for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("dataTypes"),
  }),
  defineProviderAction(service, {
    name: "get_data_type",
    description: "Get a Chattermill data type by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("dataType"),
  }),
  defineProviderAction(service, {
    name: "list_custom_segments",
    description: "List custom segments for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("customSegments"),
  }),
  defineProviderAction(service, {
    name: "get_metric",
    description: "Get a Chattermill metric value for a project.",
    requiredScopes: [],
    inputSchema: s.looseObject({ project, type: id }, { description: "Input for reading a metric." }),
    outputSchema: s.object({ metric: rawPayload, raw: rawPayload }),
  }),
  defineProviderAction(service, {
    name: "list_themes",
    description: "List themes for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("themes"),
  }),
  defineProviderAction(service, {
    name: "get_theme",
    description: "Get a Chattermill theme by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("theme"),
  }),
  defineProviderAction(service, {
    name: "list_categories",
    description: "List categories for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("categories"),
  }),
  defineProviderAction(service, {
    name: "get_category",
    description: "Get a Chattermill category by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("category"),
  }),
  defineProviderAction(service, {
    name: "list_attributes",
    description: "List attributes for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("attributes"),
  }),
  defineProviderAction(service, {
    name: "get_attribute",
    description: "Get a Chattermill attribute by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("attribute"),
  }),
  defineProviderAction(service, {
    name: "list_tags",
    description: "List tags for a Chattermill project.",
    requiredScopes: [],
    inputSchema: projectInput,
    outputSchema: listOutput("tags"),
  }),
  defineProviderAction(service, {
    name: "get_tag",
    description: "Get a Chattermill tag by ID.",
    requiredScopes: [],
    inputSchema: projectIdInput,
    outputSchema: singleOutput("tag"),
  }),
];
