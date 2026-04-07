/**
 * User Routes
 * 
 * API endpoints for user data management
 */

import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod/v4"
import { User } from "@/runtime/context/user"
import { SettingsManager } from "@/runtime/context/settings"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const UserRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "Get current user",
        description: "Get the currently authenticated user's information.",
        operationId: "user.get",
        responses: {
          200: {
            description: "User data",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const user = await User.get()
        return c.json(user)
      },
    )
    .post(
      "/refresh",
      describeRoute({
        summary: "Refresh user data",
        description: "Force refresh user data from Clerk/platform.",
        operationId: "user.refresh",
        responses: {
          200: {
            description: "Refreshed user data",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const user = await User.refresh()
        return c.json(user)
      },
    )
    .post(
      "/onboard",
      describeRoute({
        summary: "Complete user onboarding",
        description: "Save user info from onboarding and mark onboarding as complete.",
        operationId: "user.onboard",
        responses: {
          200: {
            description: "Onboarding completed",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        preferredName: z.string().optional(),
        email: z.string().email().optional(),
        organization: z.string().optional(),
      })),
      async (c) => {
        const data = c.req.valid("json")
        
        // Update user data
        await User.set({
          ...data,
          name: data.preferredName || data.firstName,
          lastSyncedAt: Date.now(),
        })
        
        // Also update settings
        await SettingsManager.updateUser(data)
        
        // Mark onboarding complete
        await SettingsManager.completeOnboarding()
        
        return c.json({ success: true })
      },
    )
    .post(
      "/clear",
      describeRoute({
        summary: "Clear user data",
        description: "Clear all user data (logout).",
        operationId: "user.clear",
        responses: {
          200: {
            description: "User data cleared",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
        },
      }),
      async (c) => {
        await User.clear()
        return c.json({ success: true })
      },
    )
)
