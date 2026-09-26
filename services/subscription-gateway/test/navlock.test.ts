import { describe, expect, it } from "vitest";
import {
  assertNavigationAllowed,
  isOriginAllowed,
  NavigationDenied,
} from "../src/security/navlock.js";

const MANIFEST = ["https://app.provider-x.example", "cdn.provider-x.example"];
const EXTRAS = ["https://auth.provider-x.example"];

const CASES: Array<[string, string, string[], string[], boolean]> = [
  // [name, url, manifest, extras, expected]
  ["manifest origin allowed", "https://app.provider-x.example/chat", MANIFEST, EXTRAS, true],
  ["bare-host origin allowed", "https://cdn.provider-x.example/a.png", MANIFEST, EXTRAS, true],
  ["extra auth origin allowed", "https://auth.provider-x.example/login", MANIFEST, EXTRAS, true],
  ["subdomain rejected", "https://evil.app.provider-x.example/", MANIFEST, EXTRAS, false],
  ["lookalike host rejected", "https://app.provider-x.example.evil.test/", MANIFEST, EXTRAS, false],
  ["http rejected", "http://app.provider-x.example/chat", MANIFEST, EXTRAS, false],
  ["localhost http exception", "http://localhost:9222/devtools", MANIFEST, EXTRAS, true],
  ["127.0.0.1 http exception", "http://127.0.0.1:3000/", MANIFEST, EXTRAS, true],
  ["unknown host rejected", "https://unrelated.example/", MANIFEST, EXTRAS, false],
  ["non-http scheme rejected", "file:///etc/passwd", MANIFEST, EXTRAS, false],
  ["garbage url rejected", "not a url", MANIFEST, EXTRAS, false],
  ["no extras still allows manifest", "https://app.provider-x.example/", MANIFEST, [], true],
  ["extras not required for denial", "https://auth.provider-x.example/", MANIFEST, [], false],
];

describe("isOriginAllowed (§A6.5)", () => {
  it.each(CASES)("%s", (_name, url, manifest, extras, expected) => {
    expect(isOriginAllowed(url, manifest, extras)).toBe(expected);
  });
});

describe("assertNavigationAllowed", () => {
  it("passes for allowed origins", () => {
    expect(() =>
      assertNavigationAllowed("https://app.provider-x.example/chat", MANIFEST, EXTRAS)
    ).not.toThrow();
  });

  it("throws a typed error for denied origins", () => {
    expect(() =>
      assertNavigationAllowed("https://unrelated.example/", MANIFEST, EXTRAS)
    ).toThrow(NavigationDenied);
  });
});
