import type { ProviderLoader } from "../../types"
import { Env } from "@/runtime/context/env/env"

export const bedrockLoader: ProviderLoader = async (data) => {
  const env = Env.all()
  const options: Record<string, unknown> = {}

  // Mirror AWS CLI/SDK precedence: explicit config wins, then env vars.
  if (!data.options?.region && env["AWS_REGION"]) {
    options.region = env["AWS_REGION"]
  }
  if (env["AWS_PROFILE"]) {
    options.profile = env["AWS_PROFILE"]
  }

  return {
    autoload: false,
    options,
  }
}
