// @ts-nocheck
import "@/cli/devMacro"
import "drizzle-orm/sqlite-core/db.js"
import "drizzle-orm/sqlite-core/session.js"
import "drizzle-orm/bun-sqlite/session.js"
import { Rpc } from "@/shared/util/rpc";
import { query } from "@/cli/ui/ink-app/query";
import { Log } from "@/shared/util/log";
import { Filesystem } from "@/shared/util/filesystem";
import { Global, init as initGlobal } from "@/runtime/context/global";

// Initialize runtime components needed by the worker
await Log.init();
await initGlobal();

let httpServer: { url: string; stop: () => void } | undefined;

const rpcHandlers = {
  async init(args: any) {
    Log.Default.info("Worker initialized", { args });
    return { success: true };
  },

  async query(args: { params: any }) {
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

  async fetch(args: { url: string; method: string; headers: any; body: any }) {
    const response = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body,
    });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };
  },

  /** Start an HTTP server for external TUI connections. */
  async server(opts: { port?: number; hostname?: string; mdns?: boolean; cors?: string[] }) {
    const { Server } = await import("@/runtime/server/server");
    await new Promise<void>((resolve) => {
      Server.listen({
        port: opts.port ?? 0,
        hostname: opts.hostname ?? "127.0.0.1",
        cors: opts.cors ?? [],
        onListen: resolve,
      });
    });
    const serverUrl = Server.url().toString();
    Log.Default.info("worker: http server started", { url: serverUrl });
    return { url: serverUrl };
  },

  /** Signal the worker to reload configuration / skills. */
  async reload(_input: undefined) {
    Log.Default.info("worker: reload requested");
    return { success: true };
  },

  /** Gracefully stop the worker. */
  async shutdown(_input: undefined) {
    Log.Default.info("worker: shutdown requested");
    httpServer?.stop();
    return { success: true };
  },

  /** Check for available upgrades. */
  async checkUpgrade(args: { directory: string }) {
    Log.Default.info("worker: checkUpgrade requested", { directory: args.directory });
    // No-op stub — upgrade checking is handled by the main process
    return { hasUpgrade: false };
  },
};

export type rpc = typeof rpcHandlers;

Rpc.listen(rpcHandlers);
