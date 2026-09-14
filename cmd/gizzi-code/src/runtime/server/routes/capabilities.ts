/**
 * GET /v1/node/capabilities
 *
 * Returns the capability record for the local harness. This is the runtime's
 * self-description: who am I, how can you reach me, and what capabilities can
 * I execute. Clients (iOS, web, another machine) use this to resolve tasks to
 * nodes without remote-controlling a desktop session.
 */
import { Hono } from "hono"
import z from "zod/v4"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"
import { buildNodeIdentity } from "@/runtime/fabric/capability-catalog"
import { nodeIdentitySchema } from "@/runtime/fabric/transport"

const NodeCapabilitiesResponse = nodeIdentitySchema

export const CapabilitiesRoutes = lazy(() =>
  new Hono().get(
    "/capabilities",
    describeRoute({
      summary: "Get local node capabilities",
      description:
        "Return the capability record for this harness: identity, endpoints, capabilities, and resources.",
      operationId: "node.capabilities.get",
      responses: {
        200: {
          description: "Node capability record",
          content: { "application/json": { schema: resolver(NodeCapabilitiesResponse) } },
        },
        ...errors(401),
      },
    }),
    async (c) => {
      const base = new URL(c.req.url)
      const url = `${base.protocol}//${base.host}`
      const identity = buildNodeIdentity({
        endpoints: [{ transport: "local", url, priority: 0 }],
      })
      return c.json(identity)
    },
  ),
)
