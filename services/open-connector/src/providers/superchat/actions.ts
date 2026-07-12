import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "superchat";

export type SuperchatActionName =
  | "get_me"
  | "list_channels"
  | "get_channel"
  | "create_contact"
  | "get_contact"
  | "list_contacts"
  | "search_contacts"
  | "update_contact"
  | "send_text_message"
  | "send_email_message"
  | "send_whatsapp_template_message";

function action(name: SuperchatActionName, description: string): ActionDefinition {
  return defineProviderAction(service, {
    name,
    description,
    inputSchema: s.looseObject(`Input parameters for ${name}.`),
    outputSchema: s.looseObject(`Superchat response for ${name}.`),
  });
}

export const superchatActions: ActionDefinition[] = [
  action("get_me", "Get the authenticated Superchat user and workspace."),
  action("list_channels", "List Superchat channels."),
  action("get_channel", "Get a Superchat channel by ID."),
  action("create_contact", "Create a Superchat contact."),
  action("get_contact", "Get a Superchat contact by ID."),
  action("list_contacts", "List Superchat contacts."),
  action("search_contacts", "Search Superchat contacts by email, phone, or custom attribute."),
  action("update_contact", "Update a Superchat contact."),
  action("send_text_message", "Send an outbound Superchat text message."),
  action("send_email_message", "Send an outbound Superchat email message."),
  action("send_whatsapp_template_message", "Send an outbound Superchat WhatsApp template message."),
];
