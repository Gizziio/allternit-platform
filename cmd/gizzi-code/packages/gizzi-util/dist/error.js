class NamedErrorBase extends Error {
  constructor(name, data = {}, options = {}) {
    super(options.cause instanceof Error ? options.cause.message : undefined)
    this.name = name
    this.data = data
    if (options.message) {
      this.message = options.message
    }
    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }

  toObject() {
    const obj = {
      name: this.name,
      data: this.data,
    }
    if (this.message) obj.message = this.message
    return obj
  }
}

const NamedError = {
  create(name, schema) {
    class SpecificNamedError extends NamedErrorBase {
      constructor(data = {}, options = {}) {
        const parsed = schema?.safeParse ? schema.safeParse(data) : { success: true, data }
        super(name, parsed.success ? parsed.data : data, options)
      }

      static isInstance(error) {
        // Errors are frequently serialized via toObject() (bus events, stored message
        // errors, MessageV2.fromError results), which produces plain {name, message, data}
        // objects. Recognize those by their name field in addition to live instances.
        return (
          error instanceof SpecificNamedError ||
          (error != null && typeof error === "object" && "name" in error && error.name === name)
        )
      }
    }

    Object.defineProperty(SpecificNamedError, "name", { value: name })
    // Consumers (MessageV2 RetryPart, openapi error resolvers) read the data
    // schema off the class as `.Schema`; without it the shape is undefined and
    // zod v4 throws "Invalid element at key …: expected a Zod schema" the first
    // time a schema carrying it is parsed (e.g. sessions with retry parts).
    SpecificNamedError.Schema = schema
    return SpecificNamedError
  },
}

export { NamedError, NamedErrorBase }
