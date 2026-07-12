import type { ProviderActionDefinition } from "../../core/provider-definition.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "pipedrive";
const idInput = (field: string, description: string) =>
  s.object(`Input for ${description}.`, { [field]: s.positiveInteger(description) });
const looseInput = (description: string) => s.looseObject(description);
const rawOutput = (description: string) => s.looseObject(description);

const actionSpecs = [
  {
    name: "list_persons",
    description: "List Pipedrive persons with optional owner, updated time, pagination, and custom field filters.",
    inputSchema: looseInput("Input for listing Pipedrive persons."),
    outputSchema: rawOutput("Pipedrive persons list response."),
  },
  {
    name: "get_person",
    description: "Get one Pipedrive person by person ID.",
    inputSchema: idInput("personId", "The Pipedrive person ID to retrieve."),
    outputSchema: rawOutput("Pipedrive person response."),
  },
  {
    name: "create_person",
    description: "Create a Pipedrive person with contact values, labels, ownership, visibility, and custom fields.",
    inputSchema: looseInput("Input for creating a Pipedrive person."),
    outputSchema: rawOutput("Pipedrive create person response."),
  },
  {
    name: "update_person",
    description: "Update one Pipedrive person by person ID.",
    inputSchema: looseInput("Input for updating a Pipedrive person."),
    outputSchema: rawOutput("Pipedrive update person response."),
  },
  {
    name: "delete_person",
    description: "Delete one Pipedrive person by person ID.",
    inputSchema: idInput("personId", "The Pipedrive person ID to delete."),
    outputSchema: rawOutput("Pipedrive delete person response."),
  },
  {
    name: "search_persons",
    description: "Search Pipedrive persons by name, email, phone, notes, or custom fields.",
    inputSchema: looseInput("Input for searching Pipedrive persons."),
    outputSchema: rawOutput("Pipedrive person search response."),
  },
  {
    name: "list_organizations",
    description:
      "List Pipedrive organizations with optional owner, updated time, pagination, and custom field filters.",
    inputSchema: looseInput("Input for listing Pipedrive organizations."),
    outputSchema: rawOutput("Pipedrive organizations list response."),
  },
  {
    name: "get_organization",
    description: "Get one Pipedrive organization by organization ID.",
    inputSchema: idInput("organizationId", "The Pipedrive organization ID to retrieve."),
    outputSchema: rawOutput("Pipedrive organization response."),
  },
  {
    name: "create_organization",
    description: "Create a Pipedrive organization with address, labels, ownership, visibility, and custom fields.",
    inputSchema: looseInput("Input for creating a Pipedrive organization."),
    outputSchema: rawOutput("Pipedrive create organization response."),
  },
  {
    name: "update_organization",
    description: "Update one Pipedrive organization by organization ID.",
    inputSchema: looseInput("Input for updating a Pipedrive organization."),
    outputSchema: rawOutput("Pipedrive update organization response."),
  },
  {
    name: "delete_organization",
    description: "Delete one Pipedrive organization by organization ID.",
    inputSchema: idInput("organizationId", "The Pipedrive organization ID to delete."),
    outputSchema: rawOutput("Pipedrive delete organization response."),
  },
  {
    name: "search_organizations",
    description: "Search Pipedrive organizations by name, address, notes, or custom fields.",
    inputSchema: looseInput("Input for searching Pipedrive organizations."),
    outputSchema: rawOutput("Pipedrive organization search response."),
  },
  {
    name: "list_deals",
    description:
      "List Pipedrive deals with optional owner, status, updated time, pagination, and custom field filters.",
    inputSchema: looseInput("Input for listing Pipedrive deals."),
    outputSchema: rawOutput("Pipedrive deals list response."),
  },
  {
    name: "get_deal",
    description: "Get one Pipedrive deal by deal ID.",
    inputSchema: idInput("dealId", "The Pipedrive deal ID to retrieve."),
    outputSchema: rawOutput("Pipedrive deal response."),
  },
  {
    name: "create_deal",
    description:
      "Create a Pipedrive deal with title, linked person or organization, value, stage, labels, and custom fields.",
    inputSchema: looseInput("Input for creating a Pipedrive deal."),
    outputSchema: rawOutput("Pipedrive create deal response."),
  },
  {
    name: "update_deal",
    description: "Update one Pipedrive deal by deal ID.",
    inputSchema: looseInput("Input for updating a Pipedrive deal."),
    outputSchema: rawOutput("Pipedrive update deal response."),
  },
  {
    name: "delete_deal",
    description: "Delete one Pipedrive deal by deal ID.",
    inputSchema: idInput("dealId", "The Pipedrive deal ID to delete."),
    outputSchema: rawOutput("Pipedrive delete deal response."),
  },
  {
    name: "search_deals",
    description: "Search Pipedrive deals by title, notes, or custom fields.",
    inputSchema: looseInput("Input for searching Pipedrive deals."),
    outputSchema: rawOutput("Pipedrive deal search response."),
  },
  {
    name: "list_activities",
    description: "List Pipedrive activities with optional user, type, date, done state, and pagination filters.",
    inputSchema: looseInput("Input for listing Pipedrive activities."),
    outputSchema: rawOutput("Pipedrive activities list response."),
  },
  {
    name: "get_activity",
    description: "Get one Pipedrive activity by activity ID.",
    inputSchema: idInput("activityId", "The Pipedrive activity ID to retrieve."),
    outputSchema: rawOutput("Pipedrive activity response."),
  },
  {
    name: "create_activity",
    description: "Create a Pipedrive activity with schedule, attendees, participants, linked entities, and notes.",
    inputSchema: looseInput("Input for creating a Pipedrive activity."),
    outputSchema: rawOutput("Pipedrive create activity response."),
  },
  {
    name: "update_activity",
    description: "Update one Pipedrive activity by activity ID.",
    inputSchema: looseInput("Input for updating a Pipedrive activity."),
    outputSchema: rawOutput("Pipedrive update activity response."),
  },
  {
    name: "delete_activity",
    description: "Delete one Pipedrive activity by activity ID.",
    inputSchema: idInput("activityId", "The Pipedrive activity ID to delete."),
    outputSchema: rawOutput("Pipedrive delete activity response."),
  },
  {
    name: "list_pipelines",
    description: "List Pipedrive pipelines with optional sorting and pagination.",
    inputSchema: looseInput("Input for listing Pipedrive pipelines."),
    outputSchema: rawOutput("Pipedrive pipelines list response."),
  },
  {
    name: "get_pipeline",
    description: "Get one Pipedrive pipeline by pipeline ID.",
    inputSchema: idInput("pipelineId", "The Pipedrive pipeline ID to retrieve."),
    outputSchema: rawOutput("Pipedrive pipeline response."),
  },
  {
    name: "list_stages",
    description: "List Pipedrive stages with optional pipeline, sorting, and pagination filters.",
    inputSchema: looseInput("Input for listing Pipedrive stages."),
    outputSchema: rawOutput("Pipedrive stages list response."),
  },
  {
    name: "get_stage",
    description: "Get one Pipedrive stage by stage ID.",
    inputSchema: idInput("stageId", "The Pipedrive stage ID to retrieve."),
    outputSchema: rawOutput("Pipedrive stage response."),
  },
];

export const pipedriveActions: ProviderActionDefinition[] = actionSpecs.map((action) =>
  defineProviderAction(service, {
    name: action.name,
    description: action.description,
    requiredScopes: [],
    inputSchema: action.inputSchema,
    outputSchema: action.outputSchema,
  }),
);
