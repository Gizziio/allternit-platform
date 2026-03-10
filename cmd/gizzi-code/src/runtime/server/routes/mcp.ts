import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { MCP } from "@/runtime/tools/mcp"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const McpRoutes = lazy(() =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List MCP servers",
        description: "Retrieve a list of all configured and active MCP (Model Context Protocol) servers.",
        operationId: "mcp.list",
        responses: {
          200: {
            description: "List of MCP servers",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const status = await MCP.status()
        return c.json(status)
      },
    )
    .post(
      "/add",
      describeRoute({
        summary: "Add MCP server",
        description: "Configure and add a new MCP server to the system.",
        operationId: "mcp.add",
        responses: {
          200: {
            description: "MCP server added successfully",
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
        const status = await MCP.add(input)
        return c.json(status)
      },
    )
    .delete(
      "/:name",
      describeRoute({
        summary: "Remove MCP server",
        description: "Remove a configured MCP server by its name.",
        operationId: "mcp.remove",
        responses: {
          200: {
            description: "MCP server removed successfully",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { name } = c.req.valid("param") as any
        await MCP.remove(name)
        return c.json(true)
      },
    ),
)
