import type {
  AssetsBinding,
  D1DatabaseBinding,
  D1PreparedStatementBinding,
  R2BucketBinding,
  R2ObjectBinding,
} from "./cloudflare/cloudflare-bindings.ts";
import type { CloudflareEnv } from "./cloudflare/cloudflare-env.ts";

import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./cloudflare.ts";

const provider = {
  service: "example",
  displayName: "Example",
  categories: ["Developer Tools"],
  authTypes: ["no_auth"],
  auth: [{ type: "no_auth" }],
  actions: [],
};

describe("cloudflare worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes connection logs to console", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await worker.fetch(
      new Request("https://connect.example.com/api/connections/example", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authType: "no_auth",
          connectionName: "work",
          values: {
            apiKey: "unused-secret",
          },
        }),
      }),
      createEnv(),
      createExecutionContext(),
    );

    expect(response.status).toBe(200);
    expect(info).toHaveBeenCalledWith(
      "connection started",
      expect.objectContaining({
        service: "example",
        authType: "no_auth",
        connectionName: "work",
      }),
    );
    expect(info).toHaveBeenCalledWith(
      "connection completed",
      expect.objectContaining({
        service: "example",
        authType: "no_auth",
        connectionName: "work",
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("unused-secret");
  });
});

function createEnv(): CloudflareEnv {
  return {
    DB: new UnusedD1Database(),
    TRANSIT_FILES: new UnusedR2Bucket(),
    ASSETS: memoryAssets({
      "/catalog/apps.json": [provider],
    }),
  };
}

function createExecutionContext(): Parameters<typeof worker.fetch>[2] {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

function memoryAssets(files: Record<string, unknown>): AssetsBinding {
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (!(pathname in files)) {
        return new Response("not found", { status: 404 });
      }

      return Response.json(files[pathname]);
    },
  };
}

class UnusedD1Database implements D1DatabaseBinding {
  prepare(query: string): D1PreparedStatementBinding {
    throw new Error(`Unexpected D1 query: ${query}`);
  }
}

class UnusedR2Bucket implements R2BucketBinding {
  async put(): Promise<unknown> {
    throw new Error("Unexpected R2 put");
  }

  async get(): Promise<R2ObjectBinding | null> {
    throw new Error("Unexpected R2 get");
  }

  async delete(): Promise<void> {
    throw new Error("Unexpected R2 delete");
  }
}
