/**
 * Fabric routes — peer discovery and capability resolution.
 *
 * These endpoints let local clients and agents inspect the Fabric without
 * reaching the platform registry directly.
 */
import { Hono } from "hono"
import z from "zod/v4"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"
import { Fabric } from "@/runtime/fabric"
import { LeaseAuthority } from "@/runtime/fabric/lease-authority"
import { capabilityQuerySchema, nodeIdentitySchema } from "@/runtime/fabric/transport"
import { buildNodeDirectory, buildNodeDirectoryEntry, buildNodeIdentity } from "@/runtime/fabric/capability-catalog"
import { WORKER_MANIFEST_PATH } from "@/runtime/fabric/capability-catalog"

const PeersQuery = capabilityQuerySchema

const IssueLeaseRequest = z.object({
  capabilityId: z.string().min(1),
  grantee: z.string().min(1),
  ttlSeconds: z.number().int().min(1).max(86400).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  policy: z
    .object({
      workloadId: z.string().optional(),
      principalId: z.string().optional(),
      budgetId: z.string().optional(),
      maxInvocations: z.number().int().min(1).optional(),
      extra: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
})

export const FabricRoutes = lazy(() =>
  new Hono()
    .post(
      "/leases",
      describeRoute({
        summary: "Issue a capability lease",
        description:
          "Mint a short-lived, node-signed Fabric lease for a capability. The lease must be presented in the X-Allternit-Lease header when invoking capabilities.",
        operationId: "fabric.leases.issue",
        responses: {
          200: {
            description: "Signed Fabric lease",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(400, 401),
        },
      }),
      validator("json", IssueLeaseRequest),
      async (c) => {
        if (process.env.GIZZI_DEV_LEASE_AUTHORITY !== "true") {
          return c.json(
            {
              error: "dev_lease_authority_disabled",
              message:
                "Runtime lease issuance is disabled. Configure a canonical AllternitOS lease authority or set GIZZI_DEV_LEASE_AUTHORITY=true for local development.",
            },
            501,
          )
        }
        const body = c.req.valid("json")
        const lease = LeaseAuthority.issue(body)
        return c.json(lease)
      },
    )
    .get(
      "/peers",
      describeRoute({
        summary: "Resolve Fabric peers",
        description:
          "Return nodes in the Fabric that match the optional capability query. No query returns all known peers.",
        operationId: "fabric.peers.resolve",
        responses: {
          200: {
            description: "Matching peer nodes",
            content: { "application/json": { schema: resolver(z.array(nodeIdentitySchema)) } },
          },
          ...errors(401),
        },
      }),
      validator("query", PeersQuery),
      async (c) => {
        const query = c.req.valid("query")
        const transport = Fabric.getTransport()
        const peers = await transport.resolve(query)
        return c.json(peers)
      },
    )
    .get(
      "/peers/local",
      describeRoute({
        summary: "Get local Fabric identity",
        description: "Return the local node's Fabric identity, if joined. Use ?format=canonical for the AllternitOS NodeDirectory entry shape.",
        operationId: "fabric.peers.local",
        responses: {
          200: {
            description: "Local node identity",
            content: { "application/json": { schema: resolver(nodeIdentitySchema) } },
          },
          ...errors(404),
        },
      }),
      validator("query", z.object({ format: z.enum(["donor", "canonical"]).optional() })),
      async (c) => {
        const transport = Fabric.getTransport()
        let identity = transport.identity()
        if (!identity) {
          const base = new URL(c.req.url)
          identity = buildNodeIdentity({
            endpoints: [{ transport: "local", url: `${base.protocol}//${base.host}`, priority: 0 }],
          })
        }
        const { format } = c.req.valid("query")
        if (format === "canonical") {
          return c.json(buildNodeDirectoryEntry(identity))
        }
        return c.json(identity)
      },
    )
    .get(
      "/directory",
      describeRoute({
        summary: "Get canonical NodeDirectory",
        description: "Return the local node's capabilities as a canonical AllternitOS NodeDirectory object.",
        operationId: "fabric.directory",
        responses: {
          200: {
            description: "Canonical NodeDirectory",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const transport = Fabric.getTransport()
        let identity = transport.identity()
        if (!identity) {
          const base = new URL(c.req.url)
          identity = buildNodeIdentity({
            endpoints: [{ transport: "local", url: `${base.protocol}//${base.host}`, priority: 0 }],
          })
        }
        return c.json(buildNodeDirectory(identity))
      },
    )
    .get(
      "/workers/self",
      describeRoute({
        summary: "Get local worker manifest",
        description: "Return the canonical AllternitOS v0.2 worker manifest for this harness runtime.",
        operationId: "fabric.workers.self",
        responses: {
          200: {
            description: "Canonical worker manifest",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(404, 500),
        },
      }),
      async (c) => {
        try {
          const text = await Bun.file(WORKER_MANIFEST_PATH).text()
          const manifest = JSON.parse(text)
          return c.json(manifest)
        } catch (error) {
          return c.json({ error: "worker_manifest_unavailable", path: WORKER_MANIFEST_PATH }, 500)
        }
      },
    ),
)
