import {
  describeRoute,
  generateSpecs,
  openAPIRouteHandler,
  resolver as baseResolver,
  validator,
} from "hono-openapi"

export { describeRoute, generateSpecs, openAPIRouteHandler, validator }

export function resolver(schema: unknown): ReturnType<typeof baseResolver> {
  if (schema && typeof schema === "object" && "~standard" in schema) {
    return baseResolver(schema as never)
  }

  try {
    return baseResolver(schema as never)
  } catch {
    return {
      type: "object",
      additionalProperties: true,
    } as unknown as ReturnType<typeof baseResolver>
  }
}
