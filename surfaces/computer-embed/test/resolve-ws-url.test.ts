/** Unit tests for the embed URL resolution (no network). */
import { describe, expect, it } from "vitest";
import { resolveWsUrl } from "../src/resolve-url.js";

const attrs = (map: Record<string, string>) => (name: string) => map[name] ?? null;

describe("resolveWsUrl", () => {
  it("derives the proxy path from host + computer + token", () => {
    const url = resolveWsUrl(
      attrs({ host: "https://api.example.com", computer: "cmp_1", token: "tok a" }),
    );
    expect(url).toBe("wss://api.example.com/ws/computers/cmp_1/vnc?token=tok%20a");
  });

  it("uses ws:// for plain http hosts", () => {
    const url = resolveWsUrl(attrs({ host: "http://localhost:8013", computer: "c", token: "t" }));
    expect(url).toBe("ws://localhost:8013/ws/computers/c/vnc?token=t");
  });

  it("passes through a full ws(s) src and appends the token", () => {
    const url = resolveWsUrl(
      attrs({ src: "wss://api.example.com/ws/computers/cmp_2/vnc", token: "abc" }),
    );
    expect(url).toBe("wss://api.example.com/ws/computers/cmp_2/vnc?token=abc");
  });

  it("keeps an existing query string intact", () => {
    const url = resolveWsUrl(
      attrs({ src: "wss://h/ws/computers/c/vnc?foo=1", token: "abc" }),
    );
    expect(url).toBe("wss://h/ws/computers/c/vnc?foo=1&token=abc");
  });

  it("omits the token param when no token is given", () => {
    const url = resolveWsUrl(attrs({ src: "wss://h/ws/computers/c/vnc" }));
    expect(url).toBe("wss://h/ws/computers/c/vnc");
  });

  it("rejects non-ws src and missing combinations", () => {
    expect(() => resolveWsUrl(attrs({ src: "https://h/x", token: "t" }))).toThrow(/ws:\/\/ or wss:\/\//);
    expect(() => resolveWsUrl(attrs({ host: "https://h", computer: "c" }))).toThrow(/token/);
    expect(() => resolveWsUrl(attrs({}))).toThrow(/src/);
    expect(() => resolveWsUrl(attrs({ host: "ftp://h", computer: "c", token: "t" }))).toThrow(
      /http\(s\)/,
    );
  });
});
