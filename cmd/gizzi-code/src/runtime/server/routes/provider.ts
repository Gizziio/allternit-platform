import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { Config } from "@/runtime/context/config/config"
import { Provider } from "@/runtime/providers/provider"
import { ModelsDev } from "@/runtime/providers/adapters/models"
import { ProviderAuth } from "@/runtime/providers/adapters/auth"
import { mapValues } from "remeda"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const ProviderRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List providers",
        description: "Get a list of all available AI providers, including both available and connected ones.",
        operationId: "provider.list",
        responses: {
          200: {
            description: "List of providers",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const config = await Config.get()
        const disabled = new Set(config.disabled_providers ?? [])
        const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined

        const allProviders = await ModelsDev.get()
        const filteredProviders: Record<string, (typeof allProviders)[string]> = {}
        for (const [key, value] of Object.entries(allProviders)) {
          if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) {
            filteredProviders[key] = value
          }
        }

        const connected = await Provider.list()
        const providers = Object.assign(
          mapValues(filteredProviders, (x) => Provider.fromModelsDevProvider(x)),
          connected,
        )
        return c.json({
          all: Object.values(providers),
          default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
          connected: Object.keys(connected),
        })
      },
    )
    .get(
      "/auth",
      describeRoute({
        summary: "Get provider auth methods",
        description: "Retrieve available authentication methods for all AI providers.",
        operationId: "provider.auth",
        responses: {
          200: {
            description: "Provider auth methods",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await ProviderAuth.methods())
      },
    )
    .post(
      "/:providerID/oauth/authorize",
      describeRoute({
        summary: "OAuth authorize",
        description: "Initiate OAuth authorization for a specific AI provider to get an authorization URL.",
        operationId: "provider.oauth.authorize",
        responses: {
          200: {
            description: "Authorization URL and method",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { providerID } = c.req.valid("param") as any
        const result = await ProviderAuth.authorize(providerID)
        return c.json(result)
      },
    )
    .post(
      "/:providerID/oauth/verify",
      describeRoute({
        summary: "OAuth verify",
        description: "Verify the OAuth authorization result from an AI provider.",
        operationId: "provider.oauth.verify",
        responses: {
          200: {
            description: "Verification result",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.any()),
      validator("json", z.any()),
      async (c) => {
        const { providerID } = c.req.valid("param") as any
        const input = c.req.valid("json") as any
        await ProviderAuth.callback({
          providerID,
          method: input.method ?? 0,
          code: input.code,
        })
        return c.json({ success: true })
      },
    ),
)
