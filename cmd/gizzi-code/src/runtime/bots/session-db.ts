/**
 * Direct, read-only access to the sqlite session store for bot-mode
 * bookkeeping (canonical-chat pin checks, roster unread counts).
 *
 * The runtime session namespace (`Session.get`, `MessageV2.stream`) assumes
 * the CLI bootstrap ran — `Global.Path.data` exists and migrations are
 * applied. Outside that context (plain bun tests, thin tooling calls) the
 * data directory may not exist yet and the lazy `Database.Client()` open
 * fails. The helpers here close that gap: they ensure the data directory
 * exists (mkdir is a no-op in real runs) and then issue plain COUNT queries
 * through the same drizzle store `Database.use` provides, so results are
 * identical to the Instance-context path.
 */

async function ensureSessionStoreDir(): Promise<void> {
  const { Global } = await import("@/runtime/context/global")
  const { mkdir } = await import("node:fs/promises")
  await mkdir(Global.Path.data, { recursive: true })
}

/** Row count of the session's messages; throws when the store is unreadable. */
export async function countSessionMessages(sessionId: string): Promise<number> {
  const { Database, eq, count } = await import("@/runtime/session/storage/db")
  const { MessageTable } = await import("@/runtime/session/session.sql")
  await ensureSessionStoreDir()
  return (
    Database.use((db) =>
      db
        .select({ n: count() })
        .from(MessageTable)
        .where(eq(MessageTable.session_id, sessionId))
        .get(),
    )?.n ?? 0
  )
}

/** True when the session id exists in the store; throws when unreadable. */
export async function sessionExistsInStore(sessionId: string): Promise<boolean> {
  const { Database, eq, count } = await import("@/runtime/session/storage/db")
  const { SessionTable } = await import("@/runtime/session/session.sql")
  await ensureSessionStoreDir()
  const row = Database.use((db) =>
    db
      .select({ n: count() })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionId))
      .get(),
  )
  return (row?.n ?? 0) > 0
}
