import {
  describeRoute,
  generateSpecs,
  openAPIRouteHandler,
  resolver as baseResolver,
  validator,
} from "hono-openapi"

export { describeRoute, generateSpecs, openAPIRouteHandler, validator }

export function resolver(schema: unknown) {
  if (schema && typeof schema === "object" && "~standard" in schema) {
    return baseResolver(schema as never)
  }

  try {
    return baseResolver(schema as never)
  } catch {
    return {
      type: "object",
      additionalProperties: true,
    }
  }
}
