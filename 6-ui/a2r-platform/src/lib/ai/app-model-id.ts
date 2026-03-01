import type { GatewayModelId } from "@ai-sdk/gateway";

export type ModelId = GatewayModelId;
export type AppModelId = ModelId | `${ModelId}-reasoning`;
