import path from "node:path";
import { z } from "zod";

/** server/ — relative paths in settings are resolved against it, not the cwd. */
export const SERVER_ROOT = path.resolve(import.meta.dirname, "..");

// All runtime settings come from environment variables (or server/.env in dev).
const Env = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(3001),
  DB_PATH: z.string().default("data/ugs.db"),
  // Still at the repo root while the Python scripts read it; moves to server/ at cleanup.
  STORES_FILE: z.string().default("../stores.json"),
  // Pause between page requests to the same store, to be polite.
  FETCH_DELAY_MS: z.coerce.number().int().min(0).default(1000),
});

const env = Env.parse(process.env);

export const config = {
  ...env,
  DB_PATH: path.resolve(SERVER_ROOT, env.DB_PATH),
  STORES_FILE: path.resolve(SERVER_ROOT, env.STORES_FILE),
};
