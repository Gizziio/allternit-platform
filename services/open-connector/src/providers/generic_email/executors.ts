import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";
import type { ImapFlow, FetchMessageObject } from "imapflow";
import type { Transporter } from "nodemailer";

import { optionalRecord, optionalString, requiredString } from "../../core/cast.ts";
import { defineProviderExecutors, ProviderRequestError, requireCustomCredential } from "../provider-runtime.ts";
import type { ExecutionContext } from "../../core/types.ts";
import type { ProviderFetch } from "../provider-runtime.ts";

interface GenericEmailCredentials {
  email: string;
  password: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
}

interface GenericEmailContext {
  values: Record<string, string>;
  fetcher: ProviderFetch;
}

function parseCredentials(values: Record<string, string>): GenericEmailCredentials {
  return {
    email: requiredString(values.email, "email", (m) => new ProviderRequestError(400, m)),
    password: requiredString(values.password, "password", (m) => new ProviderRequestError(400, m)),
    imapHost: requiredString(values.imapHost, "imapHost", (m) => new ProviderRequestError(400, m)),
    imapPort: values.imapPort?.trim() || "993",
    smtpHost: requiredString(values.smtpHost, "smtpHost", (m) => new ProviderRequestError(400, m)),
    smtpPort: values.smtpPort?.trim() || "587",
  };
}

async function loadImapFlow(): Promise<typeof ImapFlow> {
  const mod = await import("imapflow");
  return (mod.ImapFlow ?? mod.default ?? mod) as typeof ImapFlow;
}

async function loadNodemailer(): Promise<typeof import("nodemailer")> {
  return await import("nodemailer");
}

async function loadMailparser(): Promise<typeof import("mailparser")> {
  return await import("mailparser");
}

async function createImapClient(creds: GenericEmailCredentials): Promise<ImapFlow> {
  const ImapFlow = await loadImapFlow();
  const client = new ImapFlow({
    host: creds.imapHost,
    port: Number(creds.imapPort),
    secure: Number(creds.imapPort) === 993,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  });
  await client.connect();
  return client;
}

async function createSmtpTransporter(creds: GenericEmailCredentials): Promise<Transporter> {
  const nodemailer = await loadNodemailer();
  return nodemailer.createTransport({
    host: creds.smtpHost,
    port: Number(creds.smtpPort),
    secure: Number(creds.smtpPort) === 465,
    auth: { user: creds.email, pass: creds.password },
  });
}

function normalizeAddress(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed || undefined;
}

function normalizeAddressList(input: unknown): string[] {
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(input)) {
    return input.map(String).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function validateGenericEmailCredential(
  input: { values: Record<string, string> },
): Promise<CredentialValidationResult> {
  const creds = parseCredentials(input.values);
  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    return {
      profile: {
        accountId: creds.email,
        displayName: creds.email,
        grantedScopes: [],
      },
      grantedScopes: [],
      metadata: {
        imapHost: creds.imapHost,
        imapPort: creds.imapPort,
        smtpHost: creds.smtpHost,
        smtpPort: creds.smtpPort,
        inboxExists: mailbox.exists > 0,
      },
    };
  } catch (err) {
    throw new ProviderRequestError(
      400,
      err instanceof Error ? `IMAP validation failed: ${err.message}` : "IMAP validation failed",
    );
  } finally {
    await client?.close();
  }
}

async function listFolders(_input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    const tree = await client.list();
    return {
      folders: tree.map((entry) => ({
        name: entry.path,
        delimiter: entry.delimiter ?? "",
        flags: entry.flags ?? [],
      })),
    };
  } catch (err) {
    throw providerError(err, "list folders");
  } finally {
    await client?.close();
  }
}

async function listMessages(input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  const folder = optionalString(input.folder) || "INBOX";
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);
  const unseenOnly = input.unseenOnly === true;
  const pageToken = optionalString(input.pageToken);

  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    const mailbox = await client.mailboxOpen(folder, { readOnly: true });
    const total = mailbox.exists;
    const startSeq = pageToken ? Number(pageToken) : total;
    if (!Number.isFinite(startSeq) || startSeq <= 0) {
      return { messages: [], nextPageToken: undefined };
    }

    const endSeq = Math.max(startSeq - limit + 1, 1);
    const searchQuery = unseenOnly ? { unseen: true } : { all: true };

    const messages: Record<string, unknown>[] = [];
    for await (const msg of client.fetch(searchQuery, {
      uid: true,
      envelope: true,
      flags: true,
      source: false,
      bodyStructure: false,
      internalDate: true,
      headers: ["message-id"],
    }, { uid: false })) {
      messages.push(formatMessageSummary(msg as unknown as Record<string, unknown>, folder));
      if (messages.length >= limit) break;
    }

    // Sort newest first by sequence number.
    messages.sort((a, b) => Number(b.seq) - Number(a.seq));
    const nextPageToken = endSeq > 1 ? String(endSeq - 1) : undefined;

    return {
      messages: messages.slice(0, limit),
      nextPageToken,
    };
  } catch (err) {
    throw providerError(err, "list messages");
  } finally {
    await client?.close();
  }
}

async function getMessage(input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  const folder = optionalString(input.folder) || "INBOX";
  const id = requiredString(input.id, "id", (m) => new ProviderRequestError(400, m));

  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    await client.mailboxOpen(folder, { readOnly: true });
    const mailparser = await loadMailparser();

    // Prefer numeric UID if possible; otherwise use the id as a Message-ID header.
    const query = /^\d+$/.test(id) ? { uid: Number(id) } : { header: { "message-id": id } };
    const fetched: Record<string, unknown>[] = [];
    for await (const msg of client.fetch(query, { source: true, flags: true })) {
      const parsed = await mailparser.simpleParser((msg as unknown as Record<string, unknown>).source as Buffer);
      fetched.push(formatFullMessage(msg as unknown as Record<string, unknown>, parsed, folder));
      break;
    }

    if (fetched.length === 0) {
      throw new ProviderRequestError(404, `Message not found: ${id}`);
    }
    return { message: fetched[0] };
  } catch (err) {
    throw providerError(err, "get message");
  } finally {
    await client?.close();
  }
}

async function searchMessages(input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  const folder = optionalString(input.folder) || "INBOX";
  const q = requiredString(input.q, "q", (m) => new ProviderRequestError(400, m)).toLowerCase();
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);

  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    await client.mailboxOpen(folder, { readOnly: true });

    const messages: Record<string, unknown>[] = [];
    for await (const msg of client.fetch({ all: true }, { uid: true, envelope: true, flags: true, source: false })) {
      const envelope = optionalRecord((msg as unknown as Record<string, unknown>).envelope);
      const subject = optionalString(envelope?.subject)?.toLowerCase() ?? "";
      const from = normalizeAddressList(envelope?.from).join(" ").toLowerCase();
      const to = normalizeAddressList(envelope?.to).join(" ").toLowerCase();
      if (subject.includes(q) || from.includes(q) || to.includes(q)) {
        messages.push(formatMessageSummary(msg as unknown as Record<string, unknown>, folder));
      }
      if (messages.length >= limit) break;
    }

    return { messages };
  } catch (err) {
    throw providerError(err, "search messages");
  } finally {
    await client?.close();
  }
}

async function sendMessage(input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  const to = normalizeAddressList(input.to);
  if (to.length === 0) {
    throw new ProviderRequestError(400, "At least one recipient ('to') is required.");
  }

  const transporter = await createSmtpTransporter(creds);
  try {
    const info = await transporter.sendMail({
      from: creds.email,
      to,
      cc: normalizeAddressList(input.cc),
      bcc: normalizeAddressList(input.bcc),
      subject: optionalString(input.subject) || "",
      text: optionalString(input.text),
      html: optionalString(input.html),
      replyTo: normalizeAddress(input.replyTo),
      inReplyTo: optionalString(input.inReplyTo),
      references: normalizeAddressList(input.references),
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    throw providerError(err, "send message");
  } finally {
    transporter.close();
  }
}

async function replyToMessage(input: Record<string, unknown>, context: GenericEmailContext): Promise<unknown> {
  const creds = parseCredentials(context.values);
  const folder = optionalString(input.folder) || "INBOX";
  const id = requiredString(input.id, "id", (m) => new ProviderRequestError(400, m));
  const text = optionalString(input.text);
  const html = optionalString(input.html);
  const replyAll = input.replyAll === true;

  if (!text && !html) {
    throw new ProviderRequestError(400, "A reply body ('text' or 'html') is required.");
  }

  let client: ImapFlow | undefined;
  try {
    client = await createImapClient(creds);
    await client.mailboxOpen(folder, { readOnly: true });
    const mailparser = await loadMailparser();

    const query = /^\d+$/.test(id) ? { uid: Number(id) } : { header: { "message-id": id } };
    let original: Awaited<ReturnType<typeof mailparser.simpleParser>> | undefined;
    for await (const msg of client.fetch(query, { source: true })) {
      original = await mailparser.simpleParser((msg as unknown as Record<string, unknown>).source as Buffer);
      break;
    }

    if (!original) {
      throw new ProviderRequestError(404, `Message not found: ${id}`);
    }

    const subject = original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject || ""}`;
    const originalFrom = normalizeAddressList(original.from);
    const originalTo = normalizeAddressList(original.to);
    const toList = replyAll
      ? [...originalFrom, ...originalTo.filter((a) => a !== creds.email)]
      : originalFrom;
    const ccList = replyAll ? normalizeAddressList(original.cc) : [];

    const references = normalizeAddressList(original.references);
    const inReplyTo = original.messageId ?? undefined;
    if (inReplyTo) references.push(inReplyTo);

    const transporter = await createSmtpTransporter(creds);
    try {
      const info = await transporter.sendMail({
        from: creds.email,
        to: toList,
        cc: ccList,
        subject,
        text,
        html,
        inReplyTo,
        references,
      });
      return { sent: true, messageId: info.messageId };
    } finally {
      transporter.close();
    }
  } catch (err) {
    throw providerError(err, "reply to message");
  } finally {
    await client?.close();
  }
}

function formatMessageSummary(msg: Record<string, unknown>, folder: string): Record<string, unknown> {
  const envelope = optionalRecord(msg.envelope) ?? {};
  return {
    id: String(msg.uid ?? msg.seq ?? ""),
    messageId: optionalString(envelope.messageId),
    subject: optionalString(envelope.subject) || "",
    from: normalizeAddressList(envelope.from)[0] || "",
    to: normalizeAddressList(envelope.to),
    cc: normalizeAddressList(envelope.cc),
    bcc: normalizeAddressList(envelope.bcc),
    date: optionalString(envelope.date) || optionalString(msg.internalDate),
    folder,
    unread: !Array.isArray(msg.flags) || !msg.flags.includes("\\Seen"),
    flags: Array.isArray(msg.flags) ? msg.flags : [],
  };
}

function formatFullMessage(
  msg: Record<string, unknown>,
  parsed: Awaited<ReturnType<typeof import("mailparser").simpleParser>>,
  folder: string,
): Record<string, unknown> {
  const summary = formatMessageSummary(msg, folder);
  return {
    ...summary,
    text: parsed.text ?? "",
    html: parsed.html ?? "",
    attachments: (parsed.attachments ?? []).map((att) => ({
      filename: att.filename ?? "",
      contentType: att.contentType,
      size: att.size,
    })),
  };
}

function providerError(err: unknown, action: string): ProviderRequestError {
  if (err instanceof ProviderRequestError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new ProviderRequestError(502, `Failed to ${action}: ${message}`);
}

const actionHandlers: Record<string, (input: Record<string, unknown>, context: GenericEmailContext) => Promise<unknown>> = {
  list_folders: listFolders,
  list_messages: listMessages,
  get_message: getMessage,
  search_messages: searchMessages,
  send_message: sendMessage,
  reply_to_message: replyToMessage,
};

export const executors: ProviderExecutors = defineProviderExecutors<GenericEmailContext>({
  service: "generic_email",
  handlers: actionHandlers,
  async createContext(context: ExecutionContext, fetcher: ProviderFetch): Promise<GenericEmailContext> {
    const credential = await requireCustomCredential(context, "generic_email");
    return { values: credential.values, fetcher };
  },
});

export const credentialValidators: CredentialValidators = {
  customCredential: validateGenericEmailCredential,
};
