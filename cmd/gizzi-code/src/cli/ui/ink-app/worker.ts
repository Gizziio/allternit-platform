import { Rpc } from "@/shared/util/rpc";
import { query } from "@/cli/ui/ink-app/query";
import { Log } from "@/shared/util/log";
import { Filesystem } from "@/shared/util/filesystem";

// Initialize runtime components needed by the worker
await Log.init();
await Filesystem.init();

const rpcHandlers = {
  async init(args: any) {
    // Worker initialization logic
    Log.Default.info("Worker initialized", { args });
    return { success: true };
  },

  async query(args: { params: any }) {
    // Execute a query from the worker
    try {
      const generator = query(args.params);
      for await (const event of generator) {
        Rpc.emit("event", event);
      }
      return { success: true };
    } catch (error: any) {
      Log.Default.error("Query failed in worker", { error: error.message });
      throw error;
    }
  },

  async fetch(args: { url: string, method: string, headers: any, body: any }) {
    // Proxy fetch requests through the worker
    const response = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body
    });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  }
};

export type rpc = typeof rpcHandlers;

Rpc.listen(rpcHandlers);
