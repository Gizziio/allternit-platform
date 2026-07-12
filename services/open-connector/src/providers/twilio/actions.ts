import type { ActionDefinition } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "twilio";

const accountSchema = s.actionOutput(
  {
    accountSid: s.string("The Twilio account SID."),
    friendlyName: s.nullableString("The friendly name of the Twilio account."),
    status: s.nullableString("The current status of the Twilio account."),
    type: s.nullableString("The Twilio account type."),
  },
  "The normalized Twilio account payload.",
);
const usageRecordSchema = s.object("One normalized Twilio usage record.", {
  accountSid: s.nullableString("The Twilio account SID that owns the usage."),
  category: s.nullableString("The Twilio usage category."),
  count: s.nullableString("The number of units consumed in the record."),
  countUnit: s.nullableString("The unit for the usage count."),
  usage: s.nullableString("The aggregated usage amount."),
  usageUnit: s.nullableString("The unit for the aggregated usage amount."),
  price: s.nullableString("The billed price for the usage record."),
  priceUnit: s.nullableString("The currency unit for the billed price."),
  startDate: s.nullableString("The inclusive start date of the usage record."),
  endDate: s.nullableString("The inclusive end date of the usage record."),
});
const messageSchema = s.object("The normalized Twilio message payload.", {
  messageSid: s.string("The Twilio message SID."),
  accountSid: s.nullableString("The Twilio account SID that owns the message."),
  status: s.nullableString("The delivery status of the message."),
  to: s.nullableString("The destination phone number."),
  from: s.nullableString("The sender phone number."),
  body: s.nullableString("The text body of the message."),
});
const pageSizeSchema = s.integer("The maximum number of records to return in one page.", { minimum: 1 });

export const twilioActions: ActionDefinition[] = [
  defineProviderAction(service, {
    name: "get_account",
    description: "Fetch the current Twilio account profile for the connected credential.",
    requiredScopes: [],
    inputSchema: s.actionInput({}, [], "No input is required for this action."),
    outputSchema: accountSchema,
  }),
  defineProviderAction(service, {
    name: "list_usage_records",
    description: "List Twilio usage records for the connected account.",
    requiredScopes: [],
    inputSchema: s.actionInput(
      {
        category: s.string("The Twilio usage category to filter by."),
        startDate: s.date("The inclusive start date in YYYY-MM-DD format."),
        endDate: s.date("The inclusive end date in YYYY-MM-DD format."),
        pageSize: pageSizeSchema,
      },
      [],
      "The input payload for listing Twilio usage records.",
    ),
    outputSchema: s.actionOutput(
      {
        usageRecords: s.array("The normalized usage records returned by Twilio.", usageRecordSchema),
        page: s.nullableInteger("The current Twilio result page."),
        pageSize: s.nullableInteger("The Twilio page size for this result."),
        nextPageUri: s.nullableString("The next page URI returned by Twilio, if any."),
      },
      "The output payload for listing Twilio usage records.",
    ),
  }),
  defineProviderAction(service, {
    name: "list_messages",
    description: "List SMS or MMS messages for the connected Twilio account.",
    requiredScopes: [],
    inputSchema: s.actionInput(
      {
        to: s.string("Only include messages sent to this phone number."),
        from: s.string("Only include messages sent from this phone number."),
        pageSize: pageSizeSchema,
        pageToken: s.string("The Twilio page token used to continue a previous listing."),
      },
      [],
      "The input payload for listing Twilio messages.",
    ),
    outputSchema: s.actionOutput(
      {
        messages: s.array("The normalized Twilio messages.", messageSchema),
        nextPageUri: s.nullableString("The next page URI returned by Twilio, if any."),
      },
      "The output payload for listing Twilio messages.",
    ),
  }),
  defineProviderAction(service, {
    name: "get_message",
    description: "Fetch one Twilio message by message SID.",
    requiredScopes: [],
    inputSchema: s.actionInput(
      { messageSid: s.nonEmptyString("The Twilio message SID to fetch.") },
      ["messageSid"],
      "The input payload for fetching one Twilio message.",
    ),
    outputSchema: messageSchema,
  }),
  defineProviderAction(service, {
    name: "send_message",
    description: "Send an outbound SMS or MMS message with Twilio.",
    requiredScopes: [],
    inputSchema: s.actionInput(
      {
        to: s.nonEmptyString("The destination phone number in E.164 format."),
        from: s.nonEmptyString("The Twilio phone number sending the message."),
        body: s.nonEmptyString("The text body of the outbound message."),
      },
      ["to", "from", "body"],
      "The input payload for sending a Twilio message.",
    ),
    outputSchema: messageSchema,
  }),
];

export type TwilioActionName = "get_account" | "list_usage_records" | "list_messages" | "get_message" | "send_message";
