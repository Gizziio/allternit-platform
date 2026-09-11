import { describe, expect, it } from "vitest";
import {
  buildSessionBody,
  parseSseChunk,
  sessionCreateCurl,
  sessionCreateSdk,
} from "./agents-console-api";

describe("agents-console-api", () => {
  it("defaults computer.kind to none and omits empty input", () => {
    const body = buildSessionBody({
      model: "kimi-k2",
      instructions: "Be terse.",
      input: "",
      computerKind: "none",
    });
    expect(body.computer).toEqual({ kind: "none" });
    expect(body.input).toBeUndefined();
    expect((body.agent as { model: string }).model).toBe("kimi-k2");
  });

  it("includes max_cost_usd telemetry ceiling when set", () => {
    const body = buildSessionBody({
      model: "kimi-k2",
      instructions: "",
      input: "hello",
      computerKind: "desktop",
      maxCostUsd: 5,
    });
    expect(body.budget).toEqual({ max_cost_usd: 5 });
    expect(body.input).toBe("hello");
  });

  it("builds curl that matches the public sessions docs shape", () => {
    const body = buildSessionBody({
      model: "kimi-k2",
      instructions: "Be terse.",
      input: "Summarize the repo.",
      computerKind: "none",
    });
    const curl = sessionCreateCurl("http://localhost:8013", body);
    expect(curl).toContain("POST http://localhost:8013/api/v1/sessions");
    expect(curl).toContain("Authorization: Bearer $CLERK_JWT");
    expect(curl).toContain('"kind":"none"');
    expect(sessionCreateSdk(body)).toContain("@allternit/sdk/cloud-agents");
    expect(sessionCreateSdk(body)).not.toContain("openai");
  });

  it("parses SSE data frames", () => {
    const seen: string[] = [];
    const rest = parseSseChunk(
      'data: {"type":"session.created","id":"1"}\n\ndata: {"type":"turn.started"}\n\npartial',
      (event) => seen.push(String(event.type)),
    );
    expect(seen).toEqual(["session.created", "turn.started"]);
    expect(rest).toBe("partial");
  });
});
