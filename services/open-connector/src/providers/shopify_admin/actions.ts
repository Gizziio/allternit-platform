import type { ActionDefinition, JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "shopify_admin";

const gid = s.nonEmptyString("A Shopify GraphQL global ID.");
const cursor = s.nonEmptyString("A Shopify GraphQL pagination cursor.");
const query = s.nonEmptyString("A Shopify Admin API search query string.");
const first = s.integer({
  minimum: 1,
  maximum: 250,
  default: 50,
  description: "The first number of records to return.",
});
const rawObject = s.looseObject({}, { description: "The raw object returned by Shopify Admin GraphQL." });

const pageInfo = s.requiredObject("Shopify GraphQL pagination metadata.", {
  hasNextPage: s.boolean({ description: "Whether another page exists after this page." }),
  hasPreviousPage: s.boolean({ description: "Whether another page exists before this page." }),
  startCursor: s.nullable(cursor),
  endCursor: s.nullable(cursor),
});

const shop = s.requiredObject("A normalized Shopify shop.", {
  id: gid,
  name: s.string({ description: "The shop display name." }),
  myshopifyDomain: s.string({ description: "The canonical myshopify.com domain for the shop." }),
  primaryDomainUrl: s.nullable(s.url("The shop primary domain URL when returned by Shopify.")),
  primaryDomainHost: s.nullableString("The shop primary domain host when returned by Shopify."),
  raw: rawObject,
});

const productSummary = s.requiredObject("A normalized Shopify product summary.", {
  id: gid,
  title: s.string({ description: "The product title." }),
  handle: s.nullableString("The product handle when returned by Shopify."),
  status: s.nullableString("The product status when returned by Shopify."),
  vendor: s.nullableString("The product vendor when returned by Shopify."),
  productType: s.nullableString("The product type when returned by Shopify."),
  createdAt: s.nullableString("The product creation timestamp when returned by Shopify."),
  updatedAt: s.nullableString("The product update timestamp when returned by Shopify."),
  onlineStoreUrl: s.nullable(s.url("The online store product URL when returned by Shopify.")),
  cursor: s.nullable(cursor),
  raw: rawObject,
});

const productDetail = s.requiredObject("A normalized Shopify product detail.", {
  id: gid,
  title: s.string({ description: "The product title." }),
  handle: s.nullableString("The product handle when returned by Shopify."),
  status: s.nullableString("The product status when returned by Shopify."),
  vendor: s.nullableString("The product vendor when returned by Shopify."),
  productType: s.nullableString("The product type when returned by Shopify."),
  descriptionHtml: s.nullableString("The product HTML description when returned by Shopify."),
  createdAt: s.nullableString("The product creation timestamp when returned by Shopify."),
  updatedAt: s.nullableString("The product update timestamp when returned by Shopify."),
  onlineStoreUrl: s.nullable(s.url("The online store product URL when returned by Shopify.")),
  raw: rawObject,
});

const variant = s.requiredObject("A normalized Shopify product variant.", {
  id: gid,
  title: s.string({ description: "The variant title." }),
  sku: s.nullableString("The variant SKU when returned by Shopify."),
  price: s.nullableString("The variant price as a decimal string when returned by Shopify."),
  inventoryQuantity: s.nullable(s.integer({ description: "The tracked inventory quantity when returned by Shopify." })),
  productId: s.nullableString("The parent product ID when returned by Shopify."),
  productTitle: s.nullableString("The parent product title when returned by Shopify."),
  cursor: s.nullable(cursor),
  raw: rawObject,
});

const orderBase = {
  id: gid,
  name: s.string({ description: "The merchant-facing Shopify order name." }),
  email: s.nullableString("The order email address when returned by Shopify."),
  phone: s.nullableString("The order phone number when returned by Shopify."),
  displayFinancialStatus: s.nullableString("The display financial status returned by Shopify."),
  displayFulfillmentStatus: s.nullableString("The display fulfillment status returned by Shopify."),
  currencyCode: s.nullableString("The order currency code returned by Shopify."),
  totalAmount: s.nullableString("The current order total amount in shop currency when returned."),
  totalCurrencyCode: s.nullableString("The current order total currency code in shop currency when returned."),
  customerId: s.nullableString("The customer ID associated with the order when returned."),
  customerDisplayName: s.nullableString("The display name of the customer associated with the order when returned."),
  createdAt: s.nullableString("The order creation timestamp when returned by Shopify."),
  updatedAt: s.nullableString("The order update timestamp when returned by Shopify."),
};
const order = s.requiredObject("A normalized Shopify order.", {
  ...orderBase,
  cursor: s.nullable(cursor),
  raw: rawObject,
});
const orderDetail = s.requiredObject("A normalized Shopify order detail.", {
  ...orderBase,
  raw: rawObject,
});

const customerBase = {
  id: gid,
  displayName: s.string({ description: "The customer display name." }),
  firstName: s.nullableString("The customer first name when returned by Shopify."),
  lastName: s.nullableString("The customer last name when returned by Shopify."),
  email: s.nullableString("The customer email address when returned by Shopify."),
  phone: s.nullableString("The customer phone number when returned by Shopify."),
  state: s.nullableString("The customer account state when returned by Shopify."),
  tags: s.stringArray("Customer tags returned by Shopify.", { itemDescription: "A customer tag." }),
  numberOfOrders: s.nullableString("The customer's lifetime order count encoded as an unsigned 64-bit integer string."),
  amountSpent: s.nullableString("The customer's lifetime amount spent when returned."),
  amountSpentCurrencyCode: s.nullableString(
    "The currency code for the customer's lifetime amount spent when returned.",
  ),
  createdAt: s.nullableString("The customer creation timestamp when returned by Shopify."),
  updatedAt: s.nullableString("The customer update timestamp when returned by Shopify."),
};
const customer = s.requiredObject("A normalized Shopify customer.", {
  ...customerBase,
  cursor: s.nullable(cursor),
  raw: rawObject,
});
const customerDetail = s.requiredObject("A normalized Shopify customer detail.", {
  ...customerBase,
  raw: rawObject,
});

const inventoryItemBase = {
  id: gid,
  sku: s.nullableString("The inventory item SKU when returned by Shopify."),
  tracked: s.boolean({ description: "Whether Shopify tracks inventory levels for this item." }),
  requiresShipping: s.boolean({ description: "Whether this inventory item requires shipping." }),
  countryCodeOfOrigin: s.nullableString("The ISO country code of origin when returned by Shopify."),
  harmonizedSystemCode: s.nullableString("The harmonized system code when returned by Shopify."),
  createdAt: s.nullableString("The inventory item creation timestamp when returned."),
  updatedAt: s.nullableString("The inventory item update timestamp when returned."),
};
const inventoryItem = s.requiredObject("A normalized Shopify inventory item.", {
  ...inventoryItemBase,
  cursor: s.nullable(cursor),
  raw: rawObject,
});
const inventoryItemDetail = s.requiredObject("A normalized Shopify inventory item detail.", {
  ...inventoryItemBase,
  raw: rawObject,
});

const locationBase = {
  id: gid,
  name: s.string({ description: "The location name." }),
  isActive: s.boolean({ description: "Whether the location is active." }),
  fulfillsOnlineOrders: s.boolean({ description: "Whether this location can fulfill online orders." }),
  address1: s.nullableString("The first address line when returned by Shopify."),
  city: s.nullableString("The location city when returned by Shopify."),
  province: s.nullableString("The location province or state when returned by Shopify."),
  country: s.nullableString("The location country when returned by Shopify."),
  zip: s.nullableString("The location postal code when returned by Shopify."),
};
const location = s.requiredObject("A normalized Shopify location.", {
  ...locationBase,
  cursor: s.nullable(cursor),
  raw: rawObject,
});
const locationDetail = s.requiredObject("A normalized Shopify location detail.", {
  ...locationBase,
  raw: rawObject,
});

const collectionBase = {
  id: gid,
  title: s.string({ description: "The collection title." }),
  handle: s.string({ description: "The collection handle." }),
  description: s.string({ description: "The plain-text collection description." }),
  descriptionHtml: s.string({ description: "The HTML collection description." }),
  updatedAt: s.nullableString("The collection update timestamp when returned by Shopify."),
  imageUrl: s.nullable(s.url("The collection image URL when returned by Shopify.")),
};
const collection = s.requiredObject("A normalized Shopify collection.", {
  ...collectionBase,
  cursor: s.nullable(cursor),
  raw: rawObject,
});
const collectionDetail = s.requiredObject("A normalized Shopify collection detail.", {
  ...collectionBase,
  raw: rawObject,
});

const connectionInput = s.actionInput(
  {
    first,
    after: cursor,
    query,
  },
  [],
  "Shopify GraphQL connection arguments.",
);

const locationConnectionInput = s.actionInput(
  {
    first,
    after: cursor,
    query,
    includeInactive: s.boolean({ description: "Whether to include deactivated locations." }),
    includeLegacy: s.boolean({ description: "Whether to include legacy fulfillment service locations." }),
  },
  [],
  "Shopify location connection arguments.",
);

export type ShopifyAdminActionName =
  | "get_shop"
  | "list_products"
  | "get_product"
  | "list_product_variants"
  | "list_orders"
  | "get_order"
  | "list_customers"
  | "get_customer"
  | "list_inventory_items"
  | "get_inventory_item"
  | "list_locations"
  | "get_location"
  | "list_collections"
  | "get_collection"
  | "execute_graphql";

export const shopifyAdminActions: ActionDefinition[] = [
  action(
    "get_shop",
    "Retrieve basic shop information for the connected Shopify Admin token.",
    s.actionInput({}, [], "No input is required to retrieve the connected Shopify shop."),
    s.actionOutput({ shop }, "The normalized Shopify shop response."),
  ),
  action(
    "list_products",
    "List Shopify products with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        products: s.array(productSummary, { description: "Products returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify product list response.",
    ),
  ),
  action(
    "get_product",
    "Retrieve one Shopify product by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify product lookup input."),
    s.actionOutput({ product: s.nullable(productDetail) }, "The normalized Shopify product response."),
  ),
  action(
    "list_product_variants",
    "List Shopify product variants with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        variants: s.array(variant, { description: "Product variants returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify product variant list response.",
    ),
  ),
  action(
    "list_orders",
    "List Shopify orders with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        orders: s.array(order, { description: "Orders returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify order list response.",
    ),
  ),
  action(
    "get_order",
    "Retrieve one Shopify order by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify order lookup input."),
    s.actionOutput({ order: s.nullable(orderDetail) }, "The normalized Shopify order response."),
  ),
  action(
    "list_customers",
    "List Shopify customers with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        customers: s.array(customer, { description: "Customers returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify customer list response.",
    ),
  ),
  action(
    "get_customer",
    "Retrieve one Shopify customer by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify customer lookup input."),
    s.actionOutput({ customer: s.nullable(customerDetail) }, "The normalized Shopify customer response."),
  ),
  action(
    "list_inventory_items",
    "List Shopify inventory items with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        inventoryItems: s.array(inventoryItem, { description: "Inventory items returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify inventory item list response.",
    ),
  ),
  action(
    "get_inventory_item",
    "Retrieve one Shopify inventory item by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify inventory item lookup input."),
    s.actionOutput(
      { inventoryItem: s.nullable(inventoryItemDetail) },
      "The normalized Shopify inventory item response.",
    ),
  ),
  action(
    "list_locations",
    "List Shopify inventory locations with optional filters and cursor pagination.",
    locationConnectionInput,
    s.actionOutput(
      {
        locations: s.array(location, { description: "Locations returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify location list response.",
    ),
  ),
  action(
    "get_location",
    "Retrieve one Shopify location by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify location lookup input."),
    s.actionOutput({ location: s.nullable(locationDetail) }, "The normalized Shopify location response."),
  ),
  action(
    "list_collections",
    "List Shopify collections with optional search query and cursor pagination.",
    connectionInput,
    s.actionOutput(
      {
        collections: s.array(collection, { description: "Collections returned by Shopify." }),
        pageInfo,
      },
      "The normalized Shopify collection list response.",
    ),
  ),
  action(
    "get_collection",
    "Retrieve one Shopify collection by GraphQL global ID.",
    s.actionInput({ id: gid }, ["id"], "The Shopify collection lookup input."),
    s.actionOutput({ collection: s.nullable(collectionDetail) }, "The normalized Shopify collection response."),
  ),
  action(
    "execute_graphql",
    "Execute a JSON-friendly Shopify Admin GraphQL query or mutation against the connected shop.",
    s.actionInput(
      {
        query: s.nonEmptyString("The GraphQL document to execute."),
        variables: s.record(s.unknown("A variable."), {
          description: "GraphQL variables keyed by variable name.",
        }),
      },
      ["query"],
      "The Shopify Admin GraphQL request payload.",
    ),
    s.actionOutput(
      {
        data: rawObject,
        extensions: rawObject,
      },
      "The raw Shopify Admin GraphQL response data and extensions.",
      ["data"],
    ),
  ),
];

function action(
  name: ShopifyAdminActionName,
  description: string,
  inputSchema: JsonSchema,
  outputSchema: JsonSchema,
): ActionDefinition {
  return defineProviderAction(service, {
    name,
    description,
    requiredScopes: [],
    inputSchema,
    outputSchema,
  });
}
