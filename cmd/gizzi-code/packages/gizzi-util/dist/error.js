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
    return SpecificNamedError
  },
}

export { NamedError, NamedErrorBase }
