import { Hono } from "hono"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Auth } from "@/runtime/integrations/auth"
import { errors } from "@/runtime/server/error"

export function AuthRoutes() {
  return new Hono()
    .put(
      "/:providerID",
      describeRoute({
        summary: "Set auth credentials",
        description: "Set authentication credentials",
        operationId: "auth.set",
        responses: {
          200: {
            description: "Successfully set authentication credentials",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator("json", z.any()),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const info = c.req.valid("json")
        await Auth.set(providerID, info)
        return c.json(true)
      },
    )
    .delete(
      "/:providerID",
      describeRoute({
        summary: "Remove auth credentials",
        description: "Remove authentication credentials",
        operationId: "auth.remove",
        responses: {
          200: {
            description: "Successfully removed authentication credentials",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        await Auth.remove(providerID)
        return c.json(true)
      },
    )
}
