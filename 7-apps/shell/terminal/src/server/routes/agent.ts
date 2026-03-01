import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { Agent } from "../../agent/agent"
import { AgentManager } from "../../agent/manager"
import * as AgentWorkspaceLoader from "../../agent/workspace-loader"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const AgentRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List agents",
        description: "Get a list of all available agents",
        operationId: "agent.list",
        responses: {
          200: {
            description: "List of agents",
            content: {
              "application/json": {
                schema: resolver(Agent.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        // Use workspace-aware loader to include agents from .a2r/.openclaw
        const agents = await AgentWorkspaceLoader.loadAllAgents()
        return c.json(agents)
      },
    )
    .get(
      "/:name",
      describeRoute({
        summary: "Get agent",
        description: "Get details of a specific agent",
        operationId: "agent.get",
        responses: {
          200: {
            description: "Agent details",
            content: {
              "application/json": {
                schema: resolver(Agent.Info),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          name: z.string().meta({ description: "Agent name" }),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        const agent = await AgentManager.get(name)
        if (!agent) {
          return c.json({ error: `Agent "${name}" not found` }, 404)
        }
        return c.json(agent)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create agent",
        description: "Create a new custom agent",
        operationId: "agent.create",
        responses: {
          201: {
            description: "Agent created",
            content: {
              "application/json": {
                schema: resolver(Agent.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", AgentManager.AgentInput),
      async (c) => {
        const input = c.req.valid("json")
        const agent = await AgentManager.create(input)
        return c.json(agent, 201)
      },
    )
    .put(
      "/:name",
      describeRoute({
        summary: "Update agent",
        description: "Update an existing agent",
        operationId: "agent.update",
        responses: {
          200: {
            description: "Agent updated",
            content: {
              "application/json": {
                schema: resolver(Agent.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          name: z.string().meta({ description: "Agent name" }),
        }),
      ),
      validator("json", AgentManager.AgentUpdateInput),
      async (c) => {
        const { name } = c.req.valid("param")
        const input = c.req.valid("json")
        const agent = await AgentManager.update(name, input)
        return c.json(agent)
      },
    )
    .delete(
      "/:name",
      describeRoute({
        summary: "Delete agent",
        description: "Delete a custom agent",
        operationId: "agent.delete",
        responses: {
          204: {
            description: "Agent deleted",
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          name: z.string().meta({ description: "Agent name" }),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        await AgentManager.remove(name)
        return c.body(null, 204)
      },
    )
    .post(
      "/:name/generate",
      describeRoute({
        summary: "Generate agent with AI",
        description: "Generate a new agent configuration using AI based on a description",
        operationId: "agent.generate",
        responses: {
          201: {
            description: "Agent generated and created",
            content: {
              "application/json": {
                schema: resolver(Agent.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          name: z.string().meta({ description: "Agent name" }),
        }),
      ),
      validator(
        "json",
        z.object({
          description: z.string().min(1),
          model: z
            .object({
              providerID: z.string(),
              modelID: z.string(),
            })
            .optional(),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        const { description, model } = c.req.valid("json")

        // First generate the agent config
        const generated = await Agent.generate({ description, model })

        // Then create it with the generated values
        const agent = await AgentManager.create({
          name,
          description: generated.whenToUse,
          prompt: generated.systemPrompt,
          mode: "primary",
          model,
        })

        return c.json(agent, 201)
      },
    )
    .post(
      "/:name/default",
      describeRoute({
        summary: "Set default agent",
        description: "Set an agent as the default for new sessions",
        operationId: "agent.setDefault",
        responses: {
          204: {
            description: "Default agent set",
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          name: z.string().meta({ description: "Agent name" }),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        await AgentManager.setDefault(name)
        return c.body(null, 204)
      },
    ),
)
