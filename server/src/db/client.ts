import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { SERVER_ROOT } from "../config.ts";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof openDb>;

/** Open (creating if needed) the SQLite file and apply any pending migrations. */
export function openDb(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(SERVER_ROOT, "drizzle") });
  return db;
}
