/**
 * Package the API as a Netlify Function (see src/netlify.ts): bake the built
 * library and refresh status from the DB into a snapshot, and bundle it with the
 * routes into one self-contained file, netlify/functions/api.mjs at the repo root.
 *
 * Usage:  pnpm --filter @ugs/server build:netlify
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { SERVER_ROOT, config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { readLibrary } from "../src/db/library.ts";
import { readStatus } from "../src/db/status.ts";
import type { Snapshot } from "../src/netlify.ts";

const OUT_FILE = path.resolve(SERVER_ROOT, "../netlify/functions/api.mjs");

const db = openDb(config.DB_PATH);
const library = readLibrary(db);
// Never replace a working site with an empty one (say, a first run whose fetches all failed).
if (!library.games.length) {
  console.error("The library is empty: not building the API.");
  process.exit(1);
}
const job = (cron: string) => ({ cron, next: () => null }); // the function works out the next run per request
const snapshot: Snapshot = {
  library,
  status: readStatus(db, { timezone: config.CRON_TIMEZONE ?? "UTC", jobs: { prices: job(config.CRON_PRICES), genres: job(config.CRON_GENRES) } }),
};
db.$client.close();

const rateLimit = { max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW };
await build({
  stdin: {
    contents: [
      'import { createHandler } from "./netlify.ts";',
      "declare const SNAPSHOT: string;",
      `export default createHandler(JSON.parse(SNAPSHOT), ${JSON.stringify(rateLimit)});`,
      // Netlify reads this to route every /api/* request, and share links, to the function.
      'export const config = { path: ["/api/*", "/g/*"] };',
    ].join("\n"),
    resolveDir: path.join(SERVER_ROOT, "src"),
    sourcefile: "api.ts",
    loader: "ts",
  },
  // As a JSON string: V8 parses JSON much faster than an object literal this size.
  define: { SNAPSHOT: JSON.stringify(JSON.stringify(snapshot)) },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: OUT_FILE,
  // Some dependencies are CommonJS and require() Node built-ins, which an ES module can't do by itself.
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  legalComments: "none",
  logLevel: "warning",
});

const mb = (fs.statSync(OUT_FILE).size / 1e6).toFixed(1);
console.log(`${OUT_FILE}: ${library.games.length} items built ${library.builtAt}, ${mb} MB`);
