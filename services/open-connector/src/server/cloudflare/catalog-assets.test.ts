import type { AssetsBinding } from "./cloudflare-bindings.ts";

import { describe, expect, it } from "vitest";
import { loadCatalogFromAssets } from "./catalog-assets.ts";

const provider = {
  service: "example",
  displayName: "Example",
  categories: ["Developer Tools"],
  authTypes: ["no_auth"],
  auth: [{ type: "no_auth" }],
  actions: [
    {
      id: "example.ping",
      service: "example",
      name: "ping",
      description: "Ping Example.",
      requiredScopes: [],
      providerPermissions: [],
      inputSchema: {},
      outputSchema: {},
    },
  ],
};

describe("loadCatalogFromAssets", () => {
  it("loads providers from the catalog asset", async () => {
    const catalog = await loadCatalogFromAssets(
      memoryAssets({
        "/catalog/apps.json": [provider],
      }),
      { executableActionIds: ["example.ping"] },
    );

    expect(catalog.providers).toHaveLength(1);
    expect(catalog.providers[0]?.service).toBe("example");
    expect(catalog.actionsById.get("example.ping")?.execution.locallyExecutable).toBe(true);
  });

  it("fails when the catalog asset is missing", async () => {
    await expect(loadCatalogFromAssets(memoryAssets({}))).rejects.toThrow(
      "Cloudflare asset catalog request failed: /catalog/apps.json returned 404",
    );
  });
});

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
