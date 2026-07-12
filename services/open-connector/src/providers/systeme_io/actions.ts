import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "systeme_io";

export type SystemeIoActionName =
  | "list_contacts"
  | "get_contact"
  | "create_contact"
  | "update_contact"
  | "delete_contact"
  | "attach_contact_tag"
  | "detach_contact_tag"
  | "list_contact_fields"
  | "list_tags"
  | "get_tag"
  | "create_tag"
  | "delete_tag"
  | "update_tag"
  | "list_webhooks"
  | "get_webhook"
  | "create_webhook"
  | "update_webhook"
  | "delete_webhook"
  | "list_courses"
  | "list_enrollments"
  | "create_enrollment"
  | "delete_enrollment"
  | "list_subscriptions"
  | "cancel_subscription";

function action(name: SystemeIoActionName, description: string): ActionDefinition {
  return defineProviderAction(service, {
    name,
    description,
    inputSchema: s.looseObject(`Input parameters for ${name}.`),
    outputSchema: s.looseObject(`Systeme.io response for ${name}.`),
  });
}

export const systemeIoActions: ActionDefinition[] = [
  action("list_contacts", "List Systeme.io contacts."),
  action("get_contact", "Get a Systeme.io contact."),
  action("create_contact", "Create a Systeme.io contact."),
  action("update_contact", "Update a Systeme.io contact."),
  action("delete_contact", "Delete a Systeme.io contact."),
  action("attach_contact_tag", "Attach a tag to a Systeme.io contact."),
  action("detach_contact_tag", "Detach a tag from a Systeme.io contact."),
  action("list_contact_fields", "List Systeme.io contact fields."),
  action("list_tags", "List Systeme.io tags."),
  action("get_tag", "Get a Systeme.io tag."),
  action("create_tag", "Create a Systeme.io tag."),
  action("delete_tag", "Delete a Systeme.io tag."),
  action("update_tag", "Update a Systeme.io tag."),
  action("list_webhooks", "List Systeme.io webhooks."),
  action("get_webhook", "Get a Systeme.io webhook."),
  action("create_webhook", "Create a Systeme.io webhook."),
  action("update_webhook", "Update a Systeme.io webhook."),
  action("delete_webhook", "Delete a Systeme.io webhook."),
  action("list_courses", "List Systeme.io courses."),
  action("list_enrollments", "List course enrollments in Systeme.io."),
  action("create_enrollment", "Create a course enrollment in Systeme.io."),
  action("delete_enrollment", "Delete a course enrollment in Systeme.io."),
  action("list_subscriptions", "List Systeme.io subscriptions."),
  action("cancel_subscription", "Cancel a Systeme.io subscription."),
];
