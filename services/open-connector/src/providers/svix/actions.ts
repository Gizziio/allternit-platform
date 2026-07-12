import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "svix";

export type SvixActionName =
  | "list_event_types"
  | "get_event_type"
  | "create_event_type"
  | "list_applications"
  | "get_application"
  | "create_application"
  | "update_application"
  | "delete_application"
  | "list_endpoints"
  | "get_endpoint"
  | "create_endpoint"
  | "update_endpoint"
  | "delete_endpoint"
  | "list_messages"
  | "get_message"
  | "create_message";

function action(name: SvixActionName, description: string): ActionDefinition {
  return defineProviderAction(service, {
    name,
    description,
    inputSchema: s.looseObject(`Input parameters for ${name}.`),
    outputSchema: s.looseObject(`Svix response for ${name}.`),
  });
}

export const svixActions: ActionDefinition[] = [
  action("list_event_types", "List Svix event types."),
  action("get_event_type", "Get one Svix event type."),
  action("create_event_type", "Create or unarchive a Svix event type."),
  action("list_applications", "List Svix applications."),
  action("get_application", "Get one Svix application."),
  action("create_application", "Create a Svix application."),
  action("update_application", "Update a Svix application."),
  action("delete_application", "Delete a Svix application."),
  action("list_endpoints", "List endpoints for a Svix application."),
  action("get_endpoint", "Get one Svix endpoint."),
  action("create_endpoint", "Create a Svix endpoint."),
  action("update_endpoint", "Update a Svix endpoint."),
  action("delete_endpoint", "Delete a Svix endpoint."),
  action("list_messages", "List messages for a Svix application."),
  action("get_message", "Get one Svix message."),
  action("create_message", "Create a Svix message."),
];
