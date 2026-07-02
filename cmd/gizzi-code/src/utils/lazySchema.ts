/**
 * Lazy schema helper used by SDK schema modules to avoid circular-import
 * temporal dead zones. Returns the factory so the schema is created on call.
 */
export function lazySchema<T>(factory: () => T): () => T {
  return factory
}

export default lazySchema
