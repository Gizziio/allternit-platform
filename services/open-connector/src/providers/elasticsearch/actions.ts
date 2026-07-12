import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "elasticsearch";

export const elasticsearchExpandWildcardValues = ["open", "closed", "hidden", "none", "all"] as const;

const looseObjectSchema = s.looseObject("A loose JSON object returned by Elasticsearch.");
const indexNameField = s.nonEmptyString("The Elasticsearch index name.");
const optionalIndexPatternField = s.nonEmptyString(
  "A comma-separated list of index names or wildcard expressions to limit the returned indices.",
);
const paginationFromField = s.nonNegativeInteger("The starting offset for search pagination.", { default: 0 });
const paginationSizeField = s.integer({
  minimum: 1,
  maximum: 1000,
  default: 10,
  description: "The number of search results to return, capped at 1000.",
});
const sortOrderField = s.stringEnum("The sort order for this field.", ["asc", "desc"]);
const expandWildcardsField = s.stringPattern("^(open|closed|hidden|none|all)(,(open|closed|hidden|none|all))*$", {
  description: "The comma-separated wildcard expansion modes for index patterns.",
});
const comparableValueSchema = s.union([s.string(), s.number()], {
  description: "A string or number accepted by Elasticsearch range queries.",
});
const termValueSchema = s.union([s.string(), s.number(), s.boolean()], {
  description: "The exact value to match in a term query.",
});
const rangeFilterSchema = s.object(
  {
    field: s.nonEmptyString("The field to filter on."),
    gt: comparableValueSchema,
    gte: comparableValueSchema,
    lt: comparableValueSchema,
    lte: comparableValueSchema,
  },
  {
    optional: ["gt", "gte", "lt", "lte"],
    description: "A range filter for numeric, keyword, or date fields.",
  },
);
const timeFilterSchema = s.object(
  {
    field: s.nonEmptyString("The timestamp field to filter on."),
    gt: s.string("Match timestamps greater than this ISO 8601 value."),
    gte: s.string("Match timestamps greater than or equal to this ISO 8601 value."),
    lt: s.string("Match timestamps less than this ISO 8601 value."),
    lte: s.string("Match timestamps less than or equal to this ISO 8601 value."),
  },
  {
    optional: ["gt", "gte", "lt", "lte"],
    description: "A time-based range filter for timestamp fields.",
  },
);

const indexInfoSchema = s.looseObject(
  {
    index: s.string("The index name."),
    health: s.nullableString("The index health status, or null when unavailable."),
    status: s.nullableString("The index open or closed status, or null when unavailable."),
    uuid: s.nullableString("The index UUID, or null when unavailable."),
    primaryShards: s.nullableString("The number of primary shards, or null when unavailable."),
    replicaShards: s.nullableString("The number of replica shards, or null when unavailable."),
    docsCount: s.nullableString("The number of documents in the index, or null when unavailable."),
    docsDeleted: s.nullableString("The number of deleted documents, or null when unavailable."),
    storeSize: s.nullableString("The total index store size, or null when unavailable."),
    primaryStoreSize: s.nullableString("The primary shard store size, or null when unavailable."),
    creationDate: s.nullableString("The index creation timestamp, or null when unavailable."),
    creationDateString: s.nullableString("The index creation date string, or null when unavailable."),
  },
  { description: "An Elasticsearch index summary." },
);

const fieldStatisticsSchema = s.object(
  {
    totalFields: s.nonNegativeInteger("The total number of mapped fields."),
    fieldTypes: s.record("A count of mapped fields by Elasticsearch field type.", s.nonNegativeInteger("Field count.")),
  },
  { description: "Statistics derived from the index mappings." },
);

const searchHitSchema = s.looseObject(
  {
    index: s.string("The index that contains the hit."),
    id: s.string("The document identifier."),
    score: s.nullableNumber("The search score, or null when Elasticsearch omits it."),
    source: looseObjectSchema,
    highlight: s.record(
      "Highlighted snippets keyed by field name.",
      s.array(s.string("One highlighted snippet."), { description: "Highlighted snippets for one field." }),
    ),
  },
  { description: "A normalized Elasticsearch search hit." },
);

export type ElasticsearchActionName = "ping_cluster" | "list_indices" | "get_index_schema" | "query_index";

export const elasticsearchActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "ping_cluster",
    description: "Check whether the Elasticsearch cluster is reachable and return its health status.",
    inputSchema: s.object({}, { description: "The input payload for checking Elasticsearch cluster health." }),
    outputSchema: s.object(
      {
        isRunning: s.boolean("Whether the cluster health endpoint returned successfully."),
        statusCode: s.integer("The HTTP status code returned by Elasticsearch."),
        status: s.nullableString("The cluster health status, or null when unavailable."),
        clusterName: s.nullableString("The Elasticsearch cluster name, or null when unavailable."),
        message: s.string("A human-readable summary of the cluster status."),
      },
      { description: "The cluster health response." },
    ),
  }),
  defineProviderAction(service, {
    name: "list_indices",
    description: "List Elasticsearch indices visible to the connected user.",
    inputSchema: s.object(
      {
        index: optionalIndexPatternField,
        health: s.stringEnum("Filter indices by health status.", ["green", "yellow", "red"]),
        sortBy: s.nonEmptyString(
          "A comma-separated list of cat indices columns to sort by, such as index or docs.count:desc.",
        ),
        expandWildcards: expandWildcardsField,
        includePrimaryShardsOnly: s.boolean({
          default: false,
          description: "Whether to return only primary shard information.",
        }),
      },
      {
        optional: ["index", "health", "sortBy", "expandWildcards", "includePrimaryShardsOnly"],
        description: "The input payload for listing Elasticsearch indices.",
      },
    ),
    outputSchema: s.object(
      {
        indices: s.array("The list of Elasticsearch index summaries.", indexInfoSchema),
      },
      { description: "The normalized Elasticsearch indices list." },
    ),
  }),
  defineProviderAction(service, {
    name: "get_index_schema",
    description: "Get mappings, settings, aliases, and field statistics for one Elasticsearch index.",
    inputSchema: s.object(
      {
        indexName: indexNameField,
      },
      { description: "The input payload for reading one Elasticsearch index schema." },
    ),
    outputSchema: s.object(
      {
        indexName: indexNameField,
        schema: s.object(
          {
            aliases: looseObjectSchema,
            mappings: looseObjectSchema,
            settings: looseObjectSchema,
          },
          { description: "The index schema payload returned by Elasticsearch." },
        ),
        statistics: fieldStatisticsSchema,
      },
      { description: "The normalized Elasticsearch index schema response." },
    ),
  }),
  defineProviderAction(service, {
    name: "query_index",
    description: "Search an Elasticsearch index with text queries, filters, pagination, and sorting.",
    inputSchema: s.object(
      {
        indexName: indexNameField,
        query: s.nonEmptyString("A free-text query_string query."),
        from: paginationFromField,
        size: paginationSizeField,
        fields: s.stringArray("Specific document source fields to return.", {
          minItems: 1,
          itemDescription: "A source field to include in search hits.",
        }),
        highlight: s.boolean({ default: false, description: "Whether to request highlights for the search query." }),
        sort: s.array(
          "Sort order for search results.",
          s.object(
            {
              field: s.nonEmptyString("The field to sort by."),
              order: sortOrderField,
            },
            { description: "One Elasticsearch sort field." },
          ),
          { minItems: 1 },
        ),
        termFilters: s.array(
          "Exact term filters for specific field values.",
          s.object(
            {
              field: s.nonEmptyString("The field to filter on."),
              value: termValueSchema,
            },
            { description: "One exact term filter." },
          ),
          { minItems: 1 },
        ),
        rangeFilters: s.array("Range filters for fields.", rangeFilterSchema, { minItems: 1 }),
        timeFilter: timeFilterSchema,
      },
      {
        optional: ["query", "from", "size", "fields", "highlight", "sort", "termFilters", "rangeFilters", "timeFilter"],
        description: "The input payload for searching one Elasticsearch index.",
      },
    ),
    outputSchema: s.object(
      {
        indexName: indexNameField,
        totalHits: s.nonNegativeInteger("The total number of matching documents."),
        hits: s.array("The normalized search hits.", searchHitSchema),
        pagination: s.object(
          {
            from: s.nonNegativeInteger("The starting offset used for this search."),
            size: s.positiveInteger("The requested page size."),
            returned: s.nonNegativeInteger("The number of hits returned in this page."),
            hasMore: s.boolean("Whether more hits likely exist after this page."),
          },
          { description: "Pagination metadata for the search response." },
        ),
        took: s.nullableInteger("The search duration in milliseconds, or null when unavailable."),
        timedOut: s.nullableBoolean("Whether the search timed out, or null when unavailable."),
        maxScore: s.nullableNumber("The maximum score in the page, or null when unavailable."),
        aggregations: s.array(
          "Aggregation results returned by Elasticsearch, when present.",
          s.object(
            {
              name: s.string("The aggregation name."),
              result: looseObjectSchema,
            },
            { description: "One Elasticsearch aggregation result." },
          ),
        ),
      },
      {
        optional: ["aggregations"],
        description: "The normalized Elasticsearch search response.",
      },
    ),
  }),
];
