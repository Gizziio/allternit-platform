import type { RPCMethod } from "@allternit/browser-runtime-protocol/json-rpc/schemas";
import type { StagehandRpcNotification } from "@allternit/browser-runtime-protocol/types";
import type { z } from "zod/v4";

/** The transport-independent command boundary used by Stagehand's public object model. */
export interface StagehandCommandClient {
  send<Method extends RPCMethod>(
    method: Method,
    params: z.input<Method["params"]>,
  ): Promise<z.output<Method["result"]>>;
  onNotification(listener: (notification: StagehandRpcNotification) => void): () => void;
}
