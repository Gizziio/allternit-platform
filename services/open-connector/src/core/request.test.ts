import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./request.ts";

describe("assertPublicHttpUrl", () => {
  it("canonicalizes public hostnames with trailing dots", () => {
    expect(readPublicUrl("https://example.com./path").host).toBe("example.com");
  });

  it("rejects local hostnames with trailing dots", () => {
    expect(() => readPublicUrl("https://localhost./")).toThrow("target local hosts");
  });

  it("rejects local and private IPv4 address forms normalized by URL parsing", () => {
    for (const value of ["https://127.1/", "https://0177.0.0.1/", "https://2130706433/", "https://10.0.0.1/"]) {
      expect(() => readPublicUrl(value)).toThrow("private or reserved IP addresses");
    }
  });

  it("rejects internal hostname suffixes", () => {
    for (const value of ["https://router.local/", "https://service.internal/", "https://nas.lan/"]) {
      expect(() => readPublicUrl(value)).toThrow("target local hosts");
    }
  });

  it("rejects IPv6 targets", () => {
    expect(() => readPublicUrl("https://[::1]/")).toThrow("target IPv6 addresses");
  });
});

function readPublicUrl(value: string): URL {
  return assertPublicHttpUrl(value, {
    fieldName: "url",
    createError: (message) => new Error(message),
  });
}
