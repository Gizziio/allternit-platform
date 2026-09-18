import { Hono } from "hono"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Ripgrep } from "@/shared/file/ripgrep"
import { LSP } from "@/runtime/integrations/lsp"
import { File } from "@/shared/file"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const FileRoutes = lazy(() =>
  new Hono()
    .get(
      "/search",
      describeRoute({
        summary: "Search file contents",
        description: "Perform a high-performance content search across the workspace using ripgrep.",
        operationId: "file.search",
        responses: {
          200: {
            description: "Search results",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const query = c.req.valid("query") as any
        const matches = await Ripgrep.search(query)
        return c.json(matches)
      },
    )
    .get(
      "/glob",
      describeRoute({
        summary: "Find files by glob pattern",
        description: "List files matching a specific glob pattern within the workspace.",
        operationId: "file.glob",
        responses: {
          200: {
            description: "Matching file paths",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const { pattern } = c.req.valid("query") as any
        const files = await File.search({ query: pattern, type: "file" })
        return c.json(files)
      },
    )
    .get(
      "/symbols",
      describeRoute({
        summary: "List file symbols",
        description: "Retrieve all code symbols (functions, classes, variables) defined in a specific file.",
        operationId: "file.symbols",
        responses: {
          200: {
            description: "List of symbols",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const { path } = c.req.valid("query") as any
        const symbols = await LSP.documentSymbol(path)
        return c.json(symbols)
      },
    )
    .get(
      "/tree",
      describeRoute({
        summary: "Get file tree",
        description: "Retrieve a hierarchical tree representation of the workspace file structure.",
        operationId: "file.tree",
        responses: {
          200: {
            description: "Hierarchical file tree",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const query = c.req.valid("query") as any
        const tree = await File.list(query.path)
        return c.json(tree)
      },
    )
    .get(
      "/read",
      describeRoute({
        summary: "Read file content",
        description: "Retrieve the full text content of a specific file.",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const { path } = c.req.valid("query") as any
        const content = await File.read(path)
        return c.json(content)
      },
    )
    .get(
      "/info",
      describeRoute({
        summary: "Get file info",
        description: "Retrieve basic metadata (size, permissions, etc.) for a list of files.",
        operationId: "file.info",
        responses: {
          200: {
            description: "File metadata",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("query", z.any()),
      async (c) => {
        const { paths } = c.req.valid("query") as any
        const info = Array.isArray(paths) 
          ? await Promise.all(paths.map((p: string) => File.read(p)))
          : []
        return c.json(info)
      },
    ),
)
