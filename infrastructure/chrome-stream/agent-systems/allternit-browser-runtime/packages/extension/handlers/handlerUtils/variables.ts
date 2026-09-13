import type { VariableValue } from "@allternit/browser-runtime-protocol/types";

/**
 * Resolves a VariableValue to its primitive string value.
 * Handles both simple primitives ("secret") and rich objects ({ value: "secret", description: "..." }).
 */
export function resolveVariableValue(v: VariableValue): string {
  if (typeof v === "object" && v !== null && "value" in v) {
    return String(v.value);
  }
  return String(v);
}
