/**
 * Lazy Schema Utilities
 */

import { z } from 'zod/v4'

export function createLazySchema<T>(schema: z.ZodType<T>): z.ZodType<T> {
  return schema
}
