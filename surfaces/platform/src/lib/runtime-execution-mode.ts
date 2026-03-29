import { prisma } from "@/lib/db";
import { resolvePlatformUserId } from "@/lib/server-user";

export type RuntimeExecutionMode = "plan" | "safe" | "auto";

const SUPPORTED_MODES: RuntimeExecutionMode[] = ["plan", "safe", "auto"];

export function isRuntimeExecutionMode(
  value: string,
): value is RuntimeExecutionMode {
  return SUPPORTED_MODES.includes(value as RuntimeExecutionMode);
}

export async function getRuntimeExecutionModeForAuthUserId(
  authUserId: string,
) {
  const userId = await resolvePlatformUserId(authUserId);
  const preference = await prisma.userBackendPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      mode: "local",
      fallbackMode: "local",
      executionMode: "auto",
      executionModeUpdatedAt: new Date(),
    },
    select: {
      executionMode: true,
      executionModeUpdatedAt: true,
    },
  });

  return {
    mode: preference.executionMode as RuntimeExecutionMode,
    updated_at: preference.executionModeUpdatedAt.toISOString(),
    supported_modes: SUPPORTED_MODES,
  };
}

export async function setRuntimeExecutionModeForAuthUserId(
  authUserId: string,
  mode: RuntimeExecutionMode,
) {
  const userId = await resolvePlatformUserId(authUserId);
  const preference = await prisma.userBackendPreference.upsert({
    where: { userId },
    update: {
      executionMode: mode,
      executionModeUpdatedAt: new Date(),
    },
    create: {
      userId,
      mode: "local",
      fallbackMode: "local",
      executionMode: mode,
      executionModeUpdatedAt: new Date(),
    },
    select: {
      executionMode: true,
      executionModeUpdatedAt: true,
    },
  });

  return {
    mode: preference.executionMode as RuntimeExecutionMode,
    updated_at: preference.executionModeUpdatedAt.toISOString(),
    supported_modes: SUPPORTED_MODES,
  };
}
