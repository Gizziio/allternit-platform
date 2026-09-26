import { describe, expect, it } from "vitest";
import { redactExcerpt, redactText } from "../src/security/redact.js";

const CASES: Array<[string, string, string]> = [
  // [name, input, expected]
  ["email", "contact jane.doe@example.com please", "contact [redacted:email] please"],
  [
    "multiple emails",
    "a@b.co and x.y@sub.domain.org",
    "[redacted:email] and [redacted:email]",
  ],
  ["digit run ≥6", "account 123456789 on file", "account [redacted:number] on file"],
  ["short digits kept", "order 12345 ships monday", "order 12345 ships monday"],
  [
    "bearer header",
    "Authorization: Bearer abcDEF123._-xyz",
    "Authorization: [redacted:token]",
  ],
  [
    "gateway-shaped token",
    "token sgw_abcdefghijklmnop1234 leaked",
    "token [redacted:token] leaked",
  ],
  [
    "api-key-shaped token",
    "key sk-abcdefghijklmnop1234 leaked",
    "key [redacted:token] leaked",
  ],
  [
    "jwt",
    "saw eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    "saw [redacted:token]",
  ],
  ["plain text untouched", "the deck has 12 slides", "the deck has 12 slides"],
];

describe("redactText (§A6.8)", () => {
  it.each(CASES)("%s", (_name, input, expected) => {
    expect(redactText(input)).toBe(expected);
  });
});

describe("redactExcerpt", () => {
  it("redacts and leaves short strings intact", () => {
    expect(redactExcerpt("mail me at a@b.co")).toBe("mail me at [redacted:email]");
  });

  it("truncates to max chars", () => {
    const long = "x".repeat(1000);
    const out = redactExcerpt(long);
    expect(out.length).toBe(500);
    expect(out.endsWith("…")).toBe(true);
    expect(redactExcerpt(long, 10)).toBe("xxxxxxxxx…");
  });
});
