import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "doppler";

const inputSchema = s.looseObject("Doppler action input.");
const outputSchema = s.looseObject("Doppler action output.");

const dopplerActionNames = [
  ["get_auth_me", "Get metadata for the current Doppler token."],
  ["list_projects", "List Doppler projects."],
  ["get_project", "Get a Doppler project."],
  ["create_project", "Create a Doppler project."],
  ["update_project", "Update a Doppler project."],
  ["delete_project", "Delete a Doppler project."],
  ["list_environments", "List Doppler environments."],
  ["get_environment", "Get a Doppler environment."],
  ["create_environment", "Create a Doppler environment."],
  ["update_environment", "Update a Doppler environment."],
  ["delete_environment", "Delete a Doppler environment."],
  ["list_configs", "List Doppler configs."],
  ["get_config", "Get a Doppler config."],
  ["create_config", "Create a Doppler config."],
  ["update_config", "Update a Doppler config."],
  ["delete_config", "Delete a Doppler config."],
  ["clone_config", "Clone a Doppler config."],
  ["set_config_inheritable", "Set whether a Doppler config can be inherited."],
  ["list_secrets", "List Doppler secrets."],
  ["list_secret_names", "List Doppler secret names."],
  ["get_secret", "Get a Doppler secret."],
  ["download_secrets", "Download Doppler secrets."],
  ["update_secrets", "Update Doppler secrets."],
  ["delete_secret", "Delete a Doppler secret."],
  ["update_secret_note", "Update a Doppler secret note."],
  ["issue_dynamic_secret_lease", "Issue a Doppler dynamic secret lease."],
  ["revoke_dynamic_secret_lease", "Revoke a Doppler dynamic secret lease."],
  ["list_config_logs", "List Doppler config change logs."],
  ["get_config_log", "Get a Doppler config change log."],
  ["list_service_tokens", "List Doppler service tokens."],
  ["create_service_token", "Create a Doppler service token."],
  ["delete_service_token", "Delete a Doppler service token."],
  ["list_integrations", "List Doppler integrations."],
  ["get_integration", "Get a Doppler integration."],
  ["get_sync", "Get a Doppler sync."],
  ["create_sync", "Create a Doppler sync."],
  ["delete_sync", "Delete a Doppler sync."],
  ["list_change_requests", "List Doppler change requests."],
  ["create_change_request", "Create a Doppler change request."],
  ["get_change_request", "Get a Doppler change request."],
  ["update_change_request", "Update a Doppler change request."],
  ["update_change_request_assignees", "Update Doppler change request assignees."],
  ["update_change_request_unit_status", "Update a Doppler change request unit status."],
  ["review_change_request_unit", "Review a Doppler change request unit."],
] as const;

export const dopplerActions: ActionDefinition[] = dopplerActionNames.map(([name, description]) =>
  defineProviderAction(service, {
    name,
    description,
    inputSchema,
    outputSchema,
  }),
);
