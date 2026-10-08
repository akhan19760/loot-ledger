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
  // Refresh schedules (cron syntax; an optional 6th leading field is seconds).
  CRON_PRICES: z.string().default("0 4 */2 * *"), // 04:00 every other day
  CRON_GENRES: z.string().default("0 4 1 * *"), // 04:00 on the 1st of each month
  // IANA zone for the schedules, e.g. "Asia/Karachi". Default: the machine's zone.
  CRON_TIMEZONE: z.string().optional(),
  // At startup: "if-empty" fetches stores that have never been fetched (and the
  // genre list if missing); "always" also refreshes every store; "never" waits
  // for the schedule.
  REFRESH_ON_START: z.enum(["if-empty", "always", "never"]).default("if-empty"),
  // API requests allowed per client IP per window.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
});

const env = Env.parse(process.env);

export const config = {
  ...env,
  DB_PATH: path.resolve(SERVER_ROOT, env.DB_PATH),
  STORES_FILE: path.resolve(SERVER_ROOT, env.STORES_FILE),
};
