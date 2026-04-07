import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod/v4"
import { Command } from "@/runtime/loop/command"

export function CommandRoutes() {
  return new Hono().get(
    "/list",
    describeRoute({
      summary: "List commands",
      description: "Retrieve all slash commands available in the current instance.",
      operationId: "command.list",
      responses: {
        200: {
          description: "List of commands",
          content: {
            "application/json": {
              schema: resolver(z.array(z.any())),
            },
          },
        },
      },
    }),
    async (c) => {
      const commands = await Command.all()
      return c.json(commands)
    },
  )
}
