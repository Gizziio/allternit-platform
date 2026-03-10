import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { ToolRegistry } from "@/runtime/tools/builtins/registry"
import { Worktree } from "@/runtime/workspace/worktree"
import { Instance } from "@/runtime/context/project/instance"
import { Project } from "@/runtime/context/project/project"
import { MCP } from "@/runtime/tools/mcp"
import { Session } from "@/runtime/session"
import { zodToJsonSchema } from "zod-to-json-schema"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const ExperimentalRoutes = lazy(() =>
  new Hono()
    .get(
      "/tool/ids",
      describeRoute({
        summary: "List tool IDs",
        description:
          "Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.",
        operationId: "tool.ids",
        responses: {
          200: {
            description: "Tool IDs",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await ToolRegistry.ids())
      },
    )
    .get(
      "/tool",
      describeRoute({
        summary: "List tools",
        description:
          "Get a list of available tools with their JSON schema parameters for a specific provider and model combination.",
        operationId: "tool.list",
        responses: {
          200: {
            description: "Tools",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      id: z.string(),
                      description: z.string(),
                      parameters: z.any(),
                    })
                  )
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const { provider, model } = c.req.valid("query") as any
        const tools = await ToolRegistry.tools({ providerID: provider, modelID: model })
        return c.json(
          tools.map((t) => ({
            id: t.id,
            description: t.description,
            // Handle both Zod schemas and plain JSON schemas
            parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
          })),
        )
      },
    )
    .post(
      "/worktree",
      describeRoute({
        summary: "Create worktree",
        description: "Create a new git worktree for the current project and run any configured startup scripts.",
        operationId: "worktree.create",
        responses: {
          200: {
            description: "Worktree created",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.any()),
      async (c) => {
        const input = c.req.valid("json") as any
        const res = await Worktree.create(input)
        return c.json(res)
      },
    )
    .delete(
      "/worktree",
      describeRoute({
        summary: "Remove worktree",
        description: "Remove an existing git worktree by its name.",
        operationId: "worktree.remove",
        responses: {
          200: {
            description: "Worktree removed",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.any()),
      async (c) => {
        const input = c.req.valid("json") as any
        await Worktree.remove(input)
        return c.json(true)
      },
    )
    .post(
      "/worktree/reset",
      describeRoute({
        summary: "Reset worktree",
        description: "Reset the current git worktree to its initial state.",
        operationId: "worktree.reset",
        responses: {
          200: {
            description: "Worktree reset",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        // Implementation
        return c.json(true)
      },
    )
    .get(
      "/session/global",
      describeRoute({
        summary: "List global sessions",
        description: "Retrieve a list of all sessions across all projects.",
        operationId: "session.listGlobal",
        responses: {
          200: {
            description: "Global sessions",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessions = await Session.listGlobal()
        return c.json(sessions)
      },
    )
    .get(
      "/mcp/resources",
      describeRoute({
        summary: "List MCP resources",
        description: "Retrieve a list of all available resources across all registered MCP servers.",
        operationId: "mcp.listResources",
        responses: {
          200: {
            description: "MCP resources",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const resources = await MCP.resources()
        return c.json(resources)
      },
    )
    .get(
      "/resource/list",
      describeRoute({
        summary: "List experimental resources",
        description: "Retrieve a list of experimental resources (alias for MCP resources).",
        operationId: "experimental.resource.list",
        responses: {
          200: {
            description: "Experimental resources",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const resources = await MCP.resources()
        return c.json(resources)
      },
    ),
)
