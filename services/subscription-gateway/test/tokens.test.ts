import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/store/db.js";
import { issueToken, revokeToken, verifyToken } from "../src/security/tokens.js";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../src/store/migrations/", import.meta.url)
);

describe("scoped bearer tokens (§A6.2)", () => {
  it("issue → verify returns caller + scopes", () => {
    const db = openDatabase(":memory:", { migrationsDir: MIGRATIONS_DIR });
    const { token, record } = issueToken(db, "bot-1", "coding bot", [
      "tasks:submit",
      "tasks:read",
    ]);
    expect(token.startsWith("sgw_")).toBe(true);
    const verified = verifyToken(db, token);
    expect(verified).toEqual({
      caller_id: "bot-1",
      scopes: ["tasks:submit", "tasks:read"],
    });
    expect(record.revoked_at).toBeNull();
  });

  it("stores only the sha256 hash, never the plaintext", () => {
    const db = openDatabase(":memory:", { migrationsDir: MIGRATIONS_DIR });
    const { token } = issueToken(db, "bot-1", "coding bot", ["tasks:read"]);
    const row = db.prepare("SELECT token_hash FROM tokens").get() as {
      token_hash: string;
    };
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toBe(token);
  });

  it("rejects wrong tokens (constant-time compare path)", () => {
    const db = openDatabase(":memory:", { migrationsDir: MIGRATIONS_DIR });
    const { token } = issueToken(db, "bot-1", "coding bot", ["tasks:read"]);
    expect(verifyToken(db, token.slice(0, -2) + "aa")).toBeNull();
    expect(verifyToken(db, "sgw_nope")).toBeNull();
    expect(verifyToken(db, "")).toBeNull();
  });

  it("revoke → verify returns null", () => {
    const db = openDatabase(":memory:", { migrationsDir: MIGRATIONS_DIR });
    const { token, record } = issueToken(db, "bot-1", "coding bot", [
      "artifacts:read",
    ]);
    revokeToken(db, record.token_id);
    expect(verifyToken(db, token)).toBeNull();
  });

  it("two callers get independent tokens", () => {
    const db = openDatabase(":memory:", { migrationsDir: MIGRATIONS_DIR });
    const a = issueToken(db, "bot-1", "a", ["tasks:submit"]);
    const b = issueToken(db, "bot-2", "b", ["tasks:read"]);
    expect(verifyToken(db, a.token)!.caller_id).toBe("bot-1");
    expect(verifyToken(db, b.token)!.caller_id).toBe("bot-2");
  });
});
