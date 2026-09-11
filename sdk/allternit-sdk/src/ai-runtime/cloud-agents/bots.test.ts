import { describe, expect, it, vi } from "vitest";
import { Allternit } from "./client.js";

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const payload = handler(url, init);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("client.bots", () => {
  it("create|list|get|archive over the agents table with is_bot", async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const fetchImpl = mockFetch((url, init) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (method === "POST" && url.endsWith("/api/v1/agents")) {
        return { id: "bot-1", name: body.name, config: { isBot: true, botProfile: body.bot_profile } };
      }
      if (url.endsWith("/api/v1/agents")) {
        return {
          agents: [
            { id: "bot-1", name: "research", config: { isBot: true } },
            { id: "agent-9", name: "plain", config: {} },
          ],
        };
      }
      if (url.endsWith("/api/v1/agents/bot-1")) {
        return { id: "bot-1", name: "research", is_bot: true };
      }
      if (url.endsWith("/api/v1/agents/bot-1/archive")) {
        return { archived: true };
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const client = new Allternit({ baseURL: "https://api.example", fetch: fetchImpl });
    const created = await client.bots.create({
      name: "research",
      botProfile: { displayName: "Research" },
    });
    expect(created.id).toBe("bot-1");
    expect(created.isBot).toBe(true);
    expect(calls[0].body).toMatchObject({ is_bot: true, name: "research" });

    const listed = await client.bots.list();
    expect(listed.map((b) => b.id)).toEqual(["bot-1"]);

    const got = await client.bots.get("bot-1");
    expect(got.isBot).toBe(true);

    await expect(client.bots.archive("bot-1")).resolves.toEqual({ archived: true });
  });

  it("session create sends bot_id", async () => {
    const fetchImpl = mockFetch((_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.bot_id).toBe("bot-1");
      return { session: { id: "ses-1", bot_id: "bot-1", status: "idle" } };
    });
    const client = new Allternit({ baseURL: "https://api.example", fetch: fetchImpl });
    const session = await client.sessions.create({ botId: "bot-1" });
    expect(session.id).toBe("ses-1");
  });
});
