// Hand-authored public SDK facade.
// Keep the root package stable even as the generated transport evolves underneath it.
import { createA2RClient as createTransportClient } from "./gen/index.js";

function isCanonicalSuccessEnvelope(value) {
  return !!value && typeof value === "object" && "data" in value && !("error" in value);
}

async function unwrapCanonicalEnvelope(value) {
  if (isCanonicalSuccessEnvelope(value)) {
    return value.data;
  }
  return value;
}

export function createA2RClient(config = {}) {
  const userTransformer = config.responseTransformer;
  return createTransportClient({
    ...config,
    responseTransformer: async (value) => {
      const transformed = userTransformer ? await userTransformer(value) : value;
      return unwrapCanonicalEnvelope(transformed);
    },
  });
}

export const createA2R = createA2RClient;
export * from "./gen/index.js";
export * from "./tools.js";
