import { Hono } from "hono"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Project } from "@/runtime/context/project/project"
import { Instance } from "@/runtime/context/project/instance"
import { errors } from "@/runtime/server/error"

export const ProjectRoutes = () =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List projects",
        description: "Retrieve a list of all projects managed by the Allternit instance.",
        operationId: "project.list",
        responses: {
          200: {
            description: "List of projects",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const projects = await Project.list()
        return c.json(projects)
      },
    )
    .get(
      "/:projectID",
      describeRoute({
        summary: "Get project details",
        description: "Retrieve detailed information about a specific project by its ID.",
        operationId: "project.get",
        responses: {
          200: {
            description: "Project details",
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
        const { projectID } = c.req.valid("param") as any
        const project = await Project.get(projectID)
        return c.json(project)
      },
    )
    .patch(
      "/:projectID",
      describeRoute({
        summary: "Update project settings",
        description: "Update the configuration and settings for an existing project.",
        operationId: "project.update",
        responses: {
          200: {
            description: "Updated project details",
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
        const { projectID } = c.req.valid("param") as any
        const input = c.req.valid("json") as any
        const project = await Project.update({ ...input, projectID })
        return c.json(project)
      },
    )
