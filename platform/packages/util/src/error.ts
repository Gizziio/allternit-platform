/**
 * @allternit/util/error — NamedError factory
 *
 * NamedError.create(name, zodSchema) returns an Error subclass where:
 *   - instances carry a typed `.data` property
 *   - ErrorClass.isInstance(err) narrows to the subclass
 *   - `new ErrorClass(data, { cause })` works as expected
 */

/** Base class that all NamedError subclasses extend — use for instanceof checks */
export class NamedErrorBase extends Error {
  data?: unknown
  toObject() {
    return { name: this.name, message: this.message, data: this.data ?? {} }
  }
}

export const NamedError = {
  /**
   * @param name   – Error class name (shows in stack traces)
   * @param schema – Zod schema (used for type inference only at runtime)
   */
  create(name: string, schema: unknown) {
    class Err extends NamedErrorBase {
      static Schema: unknown
      constructor(data: unknown, opts?: ErrorOptions) {
        super(
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : name,
          opts,
        )
        this.name = name
        this.data = data
      }

      static isInstance(err: unknown): err is Err {
        return err instanceof Err
      }
    }

    Object.defineProperty(Err, "name", { value: name })
    Err.Schema = schema
    return Err
  },
}
