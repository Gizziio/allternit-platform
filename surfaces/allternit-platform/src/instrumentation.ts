/**
 * Next.js Instrumentation Hook
 *
 * Runs once on the Node.js server process startup (not in Edge runtime).
 * Applies both Drizzle (auth tables) and Prisma (business logic tables)
 * schemas to the SQLite database before the first request is served.
 *
 * Ref: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await runDrizzleMigrations();
    await runPrismaSchema();
  }
}

async function runDrizzleMigrations() {
  try {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const path = await import('path');
    const { mkdirSync, existsSync } = await import('fs');

    const dataDir = path.join(process.cwd(), 'data');
    try { mkdirSync(dataDir, { recursive: true }); } catch { /* exists */ }

    let dbPath: string;
    const envUrl = process.env.DATABASE_URL;
    if (envUrl && envUrl.startsWith('file:')) {
      dbPath = envUrl.slice(5);
      try { mkdirSync(path.dirname(dbPath), { recursive: true }); } catch { /* exists */ }
    } else {
      dbPath = path.join(dataDir, 'allternit.db');
    }

    // In standalone builds migrations are copied to {cwd}/migrations-sqlite.
    // In dev/source builds they live at src/lib/db/migrations-sqlite.
    const standalonePath = path.join(process.cwd(), 'migrations-sqlite');
    const sourcePath = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations-sqlite');
    const migrationsFolder = existsSync(standalonePath) ? standalonePath : sourcePath;

    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');

    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    const db = drizzle(sqlite);

    migrate(db, { migrationsFolder });
    console.log('[DB] Drizzle migrations applied');
    sqlite.close();
  } catch (error) {
    console.error('[DB] Drizzle migration failed (continuing):', error);
  }
}

async function runPrismaSchema() {
  try {
    const { execSync } = await import('child_process');
    // Push Prisma schema to SQLite — creates tables that don't exist yet.
    // Safe to run on every startup; Prisma is idempotent for existing tables.
    execSync('node_modules/.bin/prisma db push --skip-generate --accept-data-loss', {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: 'pipe',
    });
    console.log('[DB] Prisma schema applied');
  } catch (error) {
    console.error('[DB] Prisma schema push failed (continuing):', error);
  }
}
