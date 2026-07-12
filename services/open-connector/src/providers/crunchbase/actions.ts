import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "crunchbase";

export type CrunchbaseActionName = "autocomplete_entities" | "get_organization" | "search_organizations";

const rawObjectSchema = s.looseObject("Raw object returned by the official Crunchbase API.");
const entityIdentifierSchema = s.looseObject(
  {
    entity_def_id: s.string("The Crunchbase entity definition ID."),
    uuid: s.string("The Crunchbase entity UUID."),
    permalink: s.string("The Crunchbase permalink slug."),
    value: s.string("The display name for this Crunchbase identifier."),
    image_id: s.string("The Crunchbase image ID when available."),
  },
  { description: "A Crunchbase entity identifier." },
);
const autocompleteEntitySchema = s.looseObject(
  {
    identifier: entityIdentifierSchema,
    facet_ids: s.array("The facet IDs attached to this match.", s.string("One facet ID.")),
  },
  { description: "One Crunchbase autocomplete match." },
);
const fieldIdSchema = s.nonEmptyString("A Crunchbase organization field ID to include.");
const cardIdSchema = s.nonEmptyString("A Crunchbase organization card ID to include.");
const organizationSchema = s.looseObject(
  {
    cards: s.looseObject("Cards included on the organization response."),
    properties: s.looseObject("Properties included on the organization response."),
  },
  { description: "A Crunchbase organization entity." },
);
const searchPredicateSchema = s.looseObject(
  {
    type: s.string("The Crunchbase predicate type such as predicate, and, or, not, or collection."),
    field_id: s.string("The organization field ID this predicate targets."),
    operator_id: s.string("The Crunchbase operator ID for this predicate."),
    values: s.array(
      "The values applied to this predicate.",
      s.anyOf("One Crunchbase predicate value.", [
        s.string("A string predicate value."),
        s.integer("An integer predicate value."),
        s.number("A numeric predicate value."),
        s.boolean("A boolean predicate value."),
      ]),
      { minItems: 1 },
    ),
  },
  { description: "One Crunchbase search predicate or nested query group from the official Search API." },
);
const searchOrderSchema = s.object(
  {
    field_id: s.nonEmptyString("The organization field ID to sort by."),
    sort: s.stringEnum("The sort direction.", ["asc", "desc"]),
  },
  { required: ["field_id", "sort"], description: "One Crunchbase search ordering rule." },
);
const organizationSearchResultSchema = s.looseObject(
  {
    uuid: s.string("The Crunchbase organization UUID."),
    properties: s.looseObject("The requested organization fields returned by Crunchbase."),
  },
  { description: "One Crunchbase organization search result." },
);

export const crunchbaseActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "autocomplete_entities",
    description: "Suggest Crunchbase entities that match a text query.",
    inputSchema: s.object(
      {
        query: s.nonEmptyString("Text to search for in Crunchbase identifiers."),
        collectionIds: s.array(
          "Crunchbase collections to search. Omit to search all supported identifiers.",
          s.nonEmptyString("One Crunchbase collection ID such as organizations or people."),
          {
            minItems: 1,
          },
        ),
        limit: s.integer({
          minimum: 1,
          maximum: 25,
          description: "Number of suggestions to return. Crunchbase defaults to 10 and allows up to 25.",
        }),
      },
      { required: ["query"], description: "Input for requesting Crunchbase autocomplete suggestions." },
    ),
    outputSchema: s.object(
      {
        entities: s.array("Autocomplete entities returned by Crunchbase.", autocompleteEntitySchema),
        raw: rawObjectSchema,
      },
      { required: ["entities", "raw"], description: "Crunchbase autocomplete suggestions." },
    ),
  }),
  defineProviderAction(service, {
    name: "get_organization",
    description: "Look up one Crunchbase organization by UUID or permalink.",
    inputSchema: s.object(
      {
        entityId: s.nonEmptyString("Crunchbase organization UUID or permalink."),
        fieldIds: s.array("Organization field IDs to include.", fieldIdSchema, { minItems: 1 }),
        cardIds: s.array("Organization card IDs to include.", cardIdSchema, { minItems: 1 }),
      },
      { required: ["entityId"], description: "Input for looking up one Crunchbase organization." },
    ),
    outputSchema: s.object(
      {
        organization: organizationSchema,
        raw: rawObjectSchema,
      },
      { required: ["organization", "raw"], description: "Crunchbase organization lookup response." },
    ),
  }),
  defineProviderAction(service, {
    name: "search_organizations",
    description: "Search Crunchbase organizations using the official Search API query structure.",
    inputSchema: s.object(
      {
        fieldIds: s.array("Organization field IDs to include in each result.", fieldIdSchema, { minItems: 1 }),
        query: s.array("Official Crunchbase Search API predicates to apply.", searchPredicateSchema, { minItems: 1 }),
        order: s.array("Sort rules for the search response.", searchOrderSchema, { minItems: 1 }),
        limit: s.integer("Number of organizations to return.", { minimum: 1 }),
        afterId: s.nonEmptyString("Cursor ID from a previous Crunchbase search response."),
      },
      {
        optional: ["fieldIds", "query", "order", "limit", "afterId"],
        description: "Input for searching Crunchbase organizations.",
      },
    ),
    outputSchema: s.object(
      {
        count: s.integer("Number of organizations returned in this response."),
        entities: s.array("Organization search results returned by Crunchbase.", organizationSearchResultSchema),
        raw: rawObjectSchema,
      },
      { required: ["count", "entities", "raw"], description: "Crunchbase organization search response." },
    ),
  }),
];
