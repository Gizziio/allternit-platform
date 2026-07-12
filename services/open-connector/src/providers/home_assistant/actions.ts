import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "home_assistant";

const contextSchema = s.looseObject("The Home Assistant context attached to a state change.", {
  id: s.nullableString("The Home Assistant context identifier."),
  parent_id: s.nullableString("The optional parent context identifier."),
  user_id: s.nullableString("The optional Home Assistant user identifier."),
});

const stateSchema = s.looseRequiredObject(
  "One Home Assistant entity state object.",
  {
    entity_id: s.string("The Home Assistant entity identifier."),
    state: s.string("The current state value."),
    attributes: s.looseObject("The integration-specific attributes for the entity state."),
    last_changed: s.string("The timestamp when the state last changed."),
    last_updated: s.string("The timestamp when the state object was last updated."),
    context: contextSchema,
  },
  { optional: ["attributes", "context"] },
);

const emptyInputSchema = s.actionInput({}, [], "No input is required for this action.");
const entityInputSchema = s.actionInput(
  {
    entityId: s.nonEmptyString("The Home Assistant entity identifier, for example light.living_room."),
  },
  ["entityId"],
  "Input parameters for selecting one Home Assistant entity.",
);

export const homeAssistantActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "get_config",
    description: "Fetch the Home Assistant instance configuration.",
    inputSchema: emptyInputSchema,
    outputSchema: s.actionOutput(
      { config: s.looseObject("The Home Assistant configuration object.") },
      "The Home Assistant configuration response.",
    ),
  }),
  defineProviderAction(service, {
    name: "list_states",
    description: "List all current Home Assistant entity states.",
    inputSchema: emptyInputSchema,
    outputSchema: s.actionOutput(
      { states: s.array("The Home Assistant state objects.", stateSchema) },
      "The current Home Assistant entity states.",
    ),
  }),
  defineProviderAction(service, {
    name: "get_state",
    description: "Fetch the current state for one Home Assistant entity.",
    inputSchema: entityInputSchema,
    outputSchema: s.actionOutput({ state: stateSchema }, "The selected Home Assistant entity state."),
  }),
  defineProviderAction(service, {
    name: "list_services",
    description: "List Home Assistant service domains and their available services.",
    inputSchema: emptyInputSchema,
    outputSchema: s.actionOutput(
      {
        services: s.array(
          "The Home Assistant service domains returned by the instance.",
          s.looseObject("One Home Assistant service domain entry."),
        ),
      },
      "The Home Assistant service catalog.",
    ),
  }),
  defineProviderAction(service, {
    name: "call_service",
    description: "Call a Home Assistant service to control entities, such as light.turn_on or switch.turn_off.",
    inputSchema: s.actionInput(
      {
        domain: s.nonEmptyString("The Home Assistant service domain, for example light or switch."),
        service: s.nonEmptyString("The Home Assistant service name, for example turn_on or turn_off."),
        serviceData: s.looseObject(
          "The JSON service data sent directly to Home Assistant, such as entity_id or brightness.",
        ),
        returnResponse: s.boolean("Whether to request service response data with the return_response query parameter."),
      },
      ["domain", "service"],
      "Input parameters for calling one Home Assistant service.",
    ),
    outputSchema: s.actionOutput(
      {
        changedStates: s.array("The Home Assistant states changed by the service call.", stateSchema),
        serviceResponse: s.nullable(s.looseObject("The optional Home Assistant service response object.")),
      },
      "The normalized Home Assistant service call response.",
    ),
  }),
  defineProviderAction(service, {
    name: "list_events",
    description: "List Home Assistant event types currently known by the instance.",
    inputSchema: emptyInputSchema,
    outputSchema: s.actionOutput(
      {
        events: s.array(
          "The Home Assistant event type entries returned by the instance.",
          s.looseObject("One Home Assistant event type entry."),
        ),
      },
      "The Home Assistant event type catalog.",
    ),
  }),
  defineProviderAction(service, {
    name: "fire_event",
    description: "Fire one Home Assistant event with optional event data.",
    inputSchema: s.actionInput(
      {
        eventType: s.nonEmptyString("The Home Assistant event type to fire."),
        eventData: s.looseObject("The optional JSON event data sent to Home Assistant."),
      },
      ["eventType"],
      "Input parameters for firing one Home Assistant event.",
    ),
    outputSchema: s.actionOutput(
      { response: s.looseObject("The JSON response returned by Home Assistant after firing the event.") },
      "The Home Assistant fire-event response.",
    ),
  }),
  defineProviderAction(service, {
    name: "render_template",
    description: "Render a Home Assistant template against the connected instance.",
    inputSchema: s.actionInput(
      {
        template: s.nonEmptyString("The Home Assistant template string to render."),
        variables: s.looseObject("Optional template variables passed to Home Assistant."),
      },
      ["template"],
      "Input parameters for rendering one Home Assistant template.",
    ),
    outputSchema: s.actionOutput(
      { result: s.string("The rendered template text returned by Home Assistant.") },
      "The rendered Home Assistant template response.",
    ),
  }),
];

export type HomeAssistantActionName =
  | "get_config"
  | "list_states"
  | "get_state"
  | "list_services"
  | "call_service"
  | "list_events"
  | "fire_event"
  | "render_template";
