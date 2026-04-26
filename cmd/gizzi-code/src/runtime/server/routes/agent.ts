import { Hono } from "hono"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Agent } from "@/runtime/loop/agent"
import { AgentManager } from "@/runtime/loop/manager"
import * as AgentWorkspaceLoader from "@/runtime/workspace/workspace-loader"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

export const AgentRoutes = () =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List agents",
        description: "Retrieve a list of all agents available in the system.",
        operationId: "agent.list",
        responses: {
          200: {
            description: "List of agents",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const agents = await AgentWorkspaceLoader.loadAllAgents().catch(() => Agent.list())
        return c.json(agents)
      },
    )
    .post(
      "/create",
      describeRoute({
        summary: "Create agent",
        description: "Create a new agent definition.",
        operationId: "agent.create",
        responses: {
          200: {
            description: "Newly created agent",
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
        const agent = await AgentManager.create(input)
        return c.json(agent)
      },
    )
    .get(
      "/:agentID",
      describeRoute({
        summary: "Get agent details",
        description: "Retrieve detailed information about a specific agent by its ID.",
        operationId: "agent.get",
        responses: {
          200: {
            description: "Agent details",
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
        const { agentID } = c.req.valid("param") as any
        const agent = await Agent.get(agentID)
        return c.json(agent)
      },
    )
    .patch(
      "/:agentID",
      describeRoute({
        summary: "Update agent",
        description: "Update the configuration of an existing agent.",
        operationId: "agent.update",
        responses: {
          200: {
            description: "Updated agent details",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.any()),
      validator("json", z.any()),
      async (c) => {
        const { agentID } = c.req.valid("param") as any
        const input = c.req.valid("json") as any
        const agent = await AgentManager.update(agentID, input)
        return c.json(agent)
      },
    )
