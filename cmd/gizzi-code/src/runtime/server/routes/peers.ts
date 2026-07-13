import { Hono } from "hono"
import { lazy } from "@/shared/util/lazy"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { getTeammateStatuses } from "@/shared/utils/teamDiscovery"
import { markMessagesAsRead, readMailbox, writeToMailbox } from "@/shared/utils/teammateMailbox"
import { getAgentName, getTeamName } from "@/shared/utils/teammate"
import { TEAM_LEAD_NAME } from "@/shared/utils/swarm/constants"
import z from "zod/v4"

const PeerQuerySchema = z.object({
  team: z.string().min(1),
})

const InboxQuerySchema = z.object({
  team: z.string().min(1),
  agent: z.string().min(1),
})

const PeerMessageSchema = z.object({
  team: z.string().min(1),
  from: z.string().min(1),
  recipients: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
  summary: z.string().max(120).optional(),
})

export const PeerRoutes = lazy(() =>
  new Hono()
    .get(
      "/context",
      describeRoute({
        summary: "Read peer identity context",
        description: "Resolve the current Gizzi team and agent identity when runtime context is available",
        operationId: "peers.context.read",
        responses: { 200: { description: "Peer identity context", content: { "application/json": { schema: resolver(z.any()) } } } },
      }),
      (c) => {
        const team = getTeamName()
        if (team) {
          return c.json({ team, agent: getAgentName() ?? TEAM_LEAD_NAME, source: "runtime" as const })
        }
        return c.json({ team: null, agent: TEAM_LEAD_NAME, source: "fallback" as const })
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List team peers",
        description: "Discover active and idle teammates from the existing Gizzi team registry",
        operationId: "peers.list",
        responses: { 200: { description: "Peer list", content: { "application/json": { schema: resolver(z.any()) } } } },
      }),
      validator("query", PeerQuerySchema),
      async (c) => {
        const { team } = c.req.valid("query")
        return c.json({ team, peers: getTeammateStatuses(team) })
      },
    )
    .get(
      "/inbox",
      describeRoute({
        summary: "Read peer inbox",
        description: "Read file-backed teammate messages without marking them read",
        operationId: "peers.inbox.read",
        responses: { 200: { description: "Inbox messages", content: { "application/json": { schema: resolver(z.any()) } } } },
      }),
      validator("query", InboxQuerySchema),
      async (c) => {
        const { team, agent } = c.req.valid("query")
        return c.json({ team, agent, messages: await readMailbox(agent, team) })
      },
    )
    .post(
      "/messages",
      describeRoute({
        summary: "Send peer message",
        description: "Send or broadcast a message through Gizzi's locked teammate mailboxes",
        operationId: "peers.messages.send",
        responses: { 200: { description: "Message delivered", content: { "application/json": { schema: resolver(z.any()) } } } },
      }),
      validator("json", PeerMessageSchema),
      async (c) => {
        const body = c.req.valid("json")
        const timestamp = new Date().toISOString()
        await Promise.all(body.recipients.map((recipient) => writeToMailbox(recipient, {
          from: body.from,
          text: body.text,
          summary: body.summary,
          timestamp,
        }, body.team)))
        return c.json({ success: true, delivered: body.recipients.length, timestamp })
      },
    )
    .post(
      "/inbox/read",
      describeRoute({
        summary: "Mark peer inbox read",
        description: "Mark every message in a teammate inbox as read",
        operationId: "peers.inbox.markRead",
        responses: { 200: { description: "Inbox marked read", content: { "application/json": { schema: resolver(z.any()) } } } },
      }),
      validator("json", InboxQuerySchema),
      async (c) => {
        const { team, agent } = c.req.valid("json")
        await markMessagesAsRead(agent, team)
        return c.json({ success: true })
      },
    ),
)
