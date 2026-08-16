import type { ProviderDefinition } from "../../core/types.ts";

import { genericEmailActions } from "./actions.ts";

const service = "generic_email";

export const provider: ProviderDefinition = {
  service,
  displayName: "Generic Email (IMAP/SMTP)",
  categories: ["Communication", "Productivity"],
  authTypes: ["custom_credential"],
  auth: [
    {
      type: "custom_credential",
      fields: [
        {
          key: "email",
          label: "Email address",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "you@example.com",
          description: "The email address the bot will send and receive from.",
        },
        {
          key: "password",
          label: "Password",
          inputType: "password",
          required: true,
          secret: true,
          placeholder: "••••••••",
          description: "The mailbox password or app-specific password.",
        },
        {
          key: "imapHost",
          label: "IMAP host",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "imap.example.com",
          description: "The IMAP server host used to read mail.",
        },
        {
          key: "imapPort",
          label: "IMAP port",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "993",
          description: "The IMAP server port. Defaults to 993 (TLS)."
        },
        {
          key: "smtpHost",
          label: "SMTP host",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "smtp.example.com",
          description: "The SMTP server host used to send mail.",
        },
        {
          key: "smtpPort",
          label: "SMTP port",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "587",
          description: "The SMTP server port. Defaults to 587 (STARTTLS)."
        },
      ],
    },
  ],
  homepageUrl: "https://en.wikipedia.org/wiki/Internet_Message_Access_Protocol",
  actions: genericEmailActions,
};
