import type { ActionDefinition, JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const sendEmailInputSchema: JsonSchema = {
  ...s.object(
    "The input payload for sending a Resend email.",
    {
      from: s.nonEmptyString("The sender email address."),
      to: s.nonEmptyString("The recipient email address."),
      subject: s.nonEmptyString("The email subject line."),
      html: s.string("The HTML body of the email."),
      text: s.string("The plain text body of the email."),
    },
    { optional: ["html", "text"] },
  ),
  anyOf: [{ required: ["html"] }, { required: ["text"] }],
};

export type ResendActionName = "send_email";

export const resendActions: ActionDefinition[] = [
  defineProviderAction("resend", {
    name: "send_email",
    description: "Send an email with Resend.",
    inputSchema: sendEmailInputSchema,
    outputSchema: s.object("The output payload for this action.", {
      emailId: s.string("The unique identifier of the sent email."),
    }),
  }),
];
