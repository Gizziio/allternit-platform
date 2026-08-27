import type { ActionDefinition } from "../../core/types.ts";
import { s } from "../../core/json-schema.ts";

const addressField = s.string("An email address or formatted address.", { minLength: 1 });
const addressListField = s.array(
  "One or more email addresses.",
  s.string("An email address.", { minLength: 1 }),
  { minItems: 1 },
);
const messageIdField = s.string("Unique message identifier (IMAP UID or Message-ID header).", { minLength: 1 });
const folderField = s.string("Mailbox folder name, such as INBOX or Sent.", { minLength: 1 });
const limitField = s.integer("Maximum number of messages to return.", { minimum: 1, maximum: 100 });
const pageTokenField = s.string("Pagination cursor returned by a previous list call.", { minLength: 1 });

const attachmentSchema = s.object(
  "Email attachment metadata.",
  {
    filename: s.string("Attachment file name."),
    contentType: s.string("MIME content type."),
    size: s.integer("Attachment size in bytes."),
  },
  { optional: ["size"] },
);

const messageSummarySchema = s.object(
  "Summary of an email message.",
  {
    id: messageIdField,
    messageId: s.string("RFC 2822 Message-ID header."),
    subject: s.string("Message subject."),
    from: addressField,
    to: addressListField,
    cc: addressListField,
    bcc: addressListField,
    date: s.string("ISO 8601 date the message was sent."),
    preview: s.string("Plain text preview of the message body."),
    folder: folderField,
    unread: s.boolean("Whether the message is unread."),
    flags: s.array("IMAP flags on the message.", s.string("An IMAP flag.")),
    attachments: s.array("Attachments on the message.", attachmentSchema),
  },
  {
    optional: [
      "messageId",
      "cc",
      "bcc",
      "date",
      "preview",
      "unread",
      "flags",
      "attachments",
    ],
  },
);

const messageSchema = s.object(
  "A full email message.",
  {
    id: messageIdField,
    messageId: s.string("RFC 2822 Message-ID header."),
    subject: s.string("Message subject."),
    from: addressField,
    to: addressListField,
    cc: addressListField,
    bcc: addressListField,
    replyTo: addressListField,
    date: s.string("ISO 8601 date the message was sent."),
    text: s.string("Plain text body."),
    html: s.string("HTML body."),
    folder: folderField,
    unread: s.boolean("Whether the message is unread."),
    flags: s.array("IMAP flags on the message.", s.string("An IMAP flag.")),
    attachments: s.array("Attachments on the message.", attachmentSchema),
  },
  {
    optional: [
      "messageId",
      "cc",
      "bcc",
      "replyTo",
      "date",
      "text",
      "html",
      "unread",
      "flags",
      "attachments",
    ],
  },
);

export const genericEmailActions: readonly ActionDefinition[] = [
  {
    id: "generic_email.list_folders",
    service: "generic_email",
    name: "list_folders",
    description: "List mailbox folders (e.g. INBOX, Sent, Drafts).",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object("No input is required.", {}),
    outputSchema: s.object(
      "Mailbox folder list.",
      {
        folders: s.array(
          "Mailbox folders.",
          s.object("A mailbox folder.", {
            name: folderField,
            delimiter: s.string("Folder path delimiter."),
            flags: s.array("Folder flags.", s.string("A folder flag.")),
          }),
        ),
      },
    ),
  },
  {
    id: "generic_email.list_messages",
    service: "generic_email",
    name: "list_messages",
    description: "List messages in a folder, newest first.",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object(
      "Parameters for listing messages.",
      {
        folder: folderField,
        limit: limitField,
        pageToken: pageTokenField,
        unseenOnly: s.boolean("Only return unread messages."),
      },
      { optional: ["folder", "limit", "pageToken", "unseenOnly"] },
    ),
    outputSchema: s.object(
      "Paginated message list.",
      {
        messages: s.array("Message summaries.", messageSummarySchema),
        nextPageToken: pageTokenField,
      },
      { optional: ["nextPageToken"] },
    ),
  },
  {
    id: "generic_email.get_message",
    service: "generic_email",
    name: "get_message",
    description: "Fetch a single message by ID from a folder.",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object(
      "Parameters for fetching a message.",
      {
        folder: folderField,
        id: messageIdField,
      },
      { optional: ["folder"] },
    ),
    outputSchema: s.object(
      "Full message.",
      {
        message: messageSchema,
      },
    ),
  },
  {
    id: "generic_email.search_messages",
    service: "generic_email",
    name: "search_messages",
    description: "Search messages by subject, sender, or body text.",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object(
      "Search parameters.",
      {
        folder: folderField,
        q: s.string("Search query string.", { minLength: 1 }),
        limit: limitField,
        pageToken: pageTokenField,
      },
      { optional: ["folder", "limit", "pageToken"] },
    ),
    outputSchema: s.object(
      "Search results.",
      {
        messages: s.array("Matching message summaries.", messageSummarySchema),
        nextPageToken: pageTokenField,
      },
      { optional: ["nextPageToken"] },
    ),
  },
  {
    id: "generic_email.send_message",
    service: "generic_email",
    name: "send_message",
    description: "Send an email message via SMTP.",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object(
      "Send message request.",
      {
        to: addressListField,
        cc: addressListField,
        bcc: addressListField,
        subject: s.string("Message subject.", { minLength: 1 }),
        text: s.string("Plain text body."),
        html: s.string("HTML body."),
        replyTo: addressField,
        inReplyTo: s.string("Message-ID this message is replying to."),
        references: s.array("Message-ID references.", s.string("A Message-ID.")),
      },
      {
        optional: ["cc", "bcc", "text", "html", "replyTo", "inReplyTo", "references"],
      },
    ),
    outputSchema: s.object(
      "Send result.",
      {
        sent: s.boolean("Whether the message was accepted by the SMTP server."),
        messageId: s.string("SMTP message id returned by the server."),
      },
      { optional: ["messageId"] },
    ),
  },
  {
    id: "generic_email.reply_to_message",
    service: "generic_email",
    name: "reply_to_message",
    description: "Reply to an existing message by ID.",
    requiredScopes: [],
    providerPermissions: [],
    inputSchema: s.object(
      "Reply parameters.",
      {
        folder: folderField,
        id: messageIdField,
        text: s.string("Plain text reply body."),
        html: s.string("HTML reply body."),
        replyAll: s.boolean("Reply to all recipients of the original message."),
      },
      { optional: ["folder", "html", "replyAll"] },
    ),
    outputSchema: s.object(
      "Reply result.",
      {
        sent: s.boolean("Whether the reply was accepted by the SMTP server."),
        messageId: s.string("SMTP message id returned by the server."),
      },
      { optional: ["messageId"] },
    ),
  },
];
