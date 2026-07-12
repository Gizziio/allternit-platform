import type { ExecutionContext, ProviderExecutors } from "../../core/types.ts";

import { defineProviderExecutors } from "../provider-runtime.ts";
import { wttrInActionHandlers } from "./runtime.ts";

interface WttrInActionContext {
  fetcher: typeof fetch;
  signal?: AbortSignal;
}

export const executors: ProviderExecutors = defineProviderExecutors<WttrInActionContext>({
  service: "wttr_in",
  handlers: wttrInActionHandlers,
  createContext(context: ExecutionContext, fetcher: typeof fetch): WttrInActionContext {
    return {
      fetcher,
      signal: context.signal,
    };
  },
});
