import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

// PostgreSQL is used instead of a file-based database because this app is
// designed to run on serverless platforms (Vercel and similar): serverless
// functions have a read-only deployment bundle and no persistent local disk
// (only an ephemeral /tmp that isn't shared across invocations or instances),
// so a file-based database like SQLite cannot hold real data there. Point
// DATABASE_URL at any managed Postgres (Neon, Vercel Postgres, Supabase,
// Railway, RDS, or a self-hosted instance) — src/lib/repo.ts is the only
// place that would need to change if you ever swap engines again.
//
// Provider env var names vary (DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL,
// ...) so we accept the common ones.
const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!CONNECTION_STRING) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in your environment " +
      "to a PostgreSQL connection string — see .env.example. NyumbaFlow requires a real Postgres " +
      "database; it does not fall back to a local file database because that cannot persist data " +
      "on serverless hosts like Vercel."
  );
}

declare global {
  var __nyumbaflowSql: ReturnType<typeof postgres> | undefined;
  var __nyumbaflowSchemaReady: Promise<void> | undefined;
}

function createClient() {
  return postgres(CONNECTION_STRING!, {
    // Most managed Postgres providers (Neon, Supabase, Vercel Postgres, RDS)
    // require TLS and use certificates not in Node's default trust store.
    ssl: process.env.PGSSLMODE === "disable" ? false : "require",
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
    // schema.sql uses CREATE TABLE/INDEX IF NOT EXISTS, which is silent on a
    // fresh database but logs a harmless NOTICE on every cold start once the
    // tables already exist — silence that instead of spamming server logs.
    onnotice: () => {},
  });
}

export function getSql() {
  if (!global.__nyumbaflowSql) {
    global.__nyumbaflowSql = createClient();
  }
  return global.__nyumbaflowSql;
}

/**
 * Applies schema.sql (all CREATE TABLE/INDEX IF NOT EXISTS — safe to re-run).
 * Cached per warm serverless instance so it only actually hits the database
 * once per cold start, not on every request.
 */
export function ensureSchema(): Promise<void> {
  if (!global.__nyumbaflowSchemaReady) {
    const sql = getSql();
    const schema = fs.readFileSync(path.join(process.cwd(), "src/lib/schema.sql"), "utf-8");
    global.__nyumbaflowSchemaReady = sql.unsafe(schema).then(
      () => undefined,
      (err) => {
        // Let the next call retry instead of caching a permanent failure.
        global.__nyumbaflowSchemaReady = undefined;
        throw err;
      }
    );
  }
  return global.__nyumbaflowSchemaReady;
}

/** Converts `?` placeholders (as used throughout repo.ts) to Postgres `$1, $2, ...`. */
function toPositional(text: string): string {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

async function run() {
  await ensureSchema();
  return getSql();
}

/** Returns the first matching row, or undefined. Mirrors better-sqlite3's `.get()`. */
export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const sql = await run();
  const rows = await sql.unsafe(toPositional(text), params as never[]);
  return (rows[0] as T) ?? undefined;
}

/** Returns all matching rows. Mirrors better-sqlite3's `.all()`. */
export async function queryAll<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const sql = await run();
  const rows = await sql.unsafe(toPositional(text), params as never[]);
  return rows as unknown as T[];
}

/** Runs a write query. Mirrors better-sqlite3's `.run()`, returning `{ changes }`. */
export async function execute(
  text: string,
  params: unknown[] = []
): Promise<{ changes: number }> {
  const sql = await run();
  const rows = await sql.unsafe(toPositional(text), params as never[]);
  return { changes: rows.count ?? 0 };
}
