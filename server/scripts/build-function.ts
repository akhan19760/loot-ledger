/**
 * Package the API as a serverless function for one host (see src/serverless.ts): bake
 * the built library and refresh status from the DB into a snapshot, and bundle it with
 * the routes into one self-contained file.
 *
 * Usage:  pnpm --filter @lootledger/server build:netlify
 *         pnpm --filter @lootledger/server build:vercel
 *
 * Netlify gets netlify/functions/api.mjs at the repo root, and routes to it with the
 * function's own `config.path`; the rest of its routing is netlify.toml. Vercel gets a
 * whole .vercel/output/ (Build Output API v3): the function, the site copied in beside
 * it, and the routing that netlify.toml holds for Netlify. Neither host builds anything
 * itself — the deploy workflow uploads these as they are.
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { SERVER_ROOT, config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { readLibrary } from "../src/db/library.ts";
import { readStatus } from "../src/db/status.ts";
import type { Snapshot } from "../src/serverless.ts";

const REPO_ROOT = path.resolve(SERVER_ROOT, "..");
const WEB_DIST = path.join(REPO_ROOT, "web/dist");
/** Keep in sync with "engines" in the root package.json and the workflow's setup-node. */
const NODE_RUNTIME = "nodejs22.x";
const A_YEAR = 31536000;

interface Target {
  /** The bundle esbuild writes. */
  outFile: string;
  /** Emptied first, so nothing from an earlier build can ride along with this deploy. */
  clean: string;
  /** The host's adapter and routing wrapped around the shared handler. */
  entry: (rateLimit: string) => string[];
  /** Run after the bundle: the host's own deploy metadata, and anything else it needs. */
  finish?: () => void;
}

const targets: Record<string, Target> = {
  netlify: {
    outFile: path.join(REPO_ROOT, "netlify/functions/api.mjs"),
    clean: path.join(REPO_ROOT, "netlify/functions"),
    entry: (rateLimit) => [
      'import { netlify } from "./hosts/netlify.ts";',
      'import { createHandler } from "./serverless.ts";',
      "declare const SNAPSHOT: string;",
      `export default createHandler(JSON.parse(SNAPSHOT), ${rateLimit}, netlify);`,
      // Netlify reads this to route every /api/* request, and share links, to the function.
      'export const config = { path: ["/api/*", "/g/*"] };',
    ],
  },
  vercel: vercelTarget(),
};

/**
 * .vercel/output/, which `vercel deploy --prebuilt` uploads as the whole deployment:
 *
 *   static/                 the site, served by the CDN before the function is tried
 *   functions/api.func/     the function; the .func suffix is dropped, so it is /api
 *   config.json             the routing, and the headers netlify.toml sets
 *
 * Only .vercel/output is rewritten: .vercel/project.json, which links the directory to
 * a Vercel project, is left where `vercel link` put it.
 */
function vercelTarget(): Target {
  const out = path.join(REPO_ROOT, ".vercel/output");
  const fn = path.join(out, "functions/api.func");
  return {
    outFile: path.join(fn, "index.mjs"),
    clean: out,
    entry: (rateLimit) => [
      'import { vercel } from "./hosts/vercel.ts";',
      'import { createHandler } from "./serverless.ts";',
      "declare const SNAPSHOT: string;",
      `const handler = createHandler(JSON.parse(SNAPSHOT), ${rateLimit}, vercel);`,
      // A Web handler: Vercel's Node runtime hands it the request and nothing else.
      "const serve = (request: Request) => handler(request, undefined);",
      "export const GET = serve, HEAD = serve, POST = serve, OPTIONS = serve;",
    ],
    finish: () => {
      if (!fs.existsSync(path.join(WEB_DIST, "index.html")))
        fail(`${WEB_DIST} has no index.html: run \`pnpm --filter @lootledger/web build\` first.`);
      fs.cpSync(WEB_DIST, path.join(out, "static"), { recursive: true });

      fs.writeFileSync(
        path.join(fn, ".vc-config.json"),
        json({ runtime: NODE_RUNTIME, handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false }),
      );

      fs.writeFileSync(
        path.join(out, "config.json"),
        json({
          version: 3,
          routes: [
            // Vite fingerprints every file in /assets, so browsers can keep them for good.
            { src: "/assets/(.*)", headers: { "cache-control": `public, max-age=${A_YEAR}, immutable` }, continue: true },
            // The site first: only a path with no file of its own reaches the function.
            { handle: "filesystem" },
            // The API, and share links, are the function — Netlify's `config.path`, in Vercel's
            // spelling. `dest` picks which function answers; the function still sees the path
            // that was asked for, which is what the routes in src/app.ts match on.
            { src: "/api(/.*)?", dest: "/api" },
            { src: "/g/.*", dest: "/api" },
            // The deals page is the same single-page app at its own path.
            { src: "/deals/?", dest: "/index.html" },
          ],
        }),
      );
    },
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const name = process.argv[2];
const target = name ? targets[name] : undefined;
if (!target) fail(`unknown host "${name ?? ""}": use ${Object.keys(targets).join(", ")}`);

const db = openDb(config.DB_PATH);
const library = readLibrary(db);
// Never replace a working site with an empty one (say, a first run whose fetches all failed).
if (!library.games.length) fail("The library is empty: not building the API.");
const job = (cron: string) => ({ cron, next: () => null }); // the function works out the next run per request
const snapshot: Snapshot = {
  library,
  status: readStatus(db, { timezone: config.CRON_TIMEZONE ?? "UTC", jobs: { prices: job(config.CRON_PRICES), genres: job(config.CRON_GENRES) } }),
};
db.$client.close();

fs.rmSync(target.clean, { recursive: true, force: true });

const rateLimit = JSON.stringify({ max: config.RATE_LIMIT_MAX, timeWindow: config.RATE_LIMIT_WINDOW });
await build({
  stdin: {
    contents: target.entry(rateLimit).join("\n"),
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
  outfile: target.outFile,
  // Some dependencies are CommonJS and require() Node built-ins, which an ES module can't do by itself.
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  legalComments: "none",
  logLevel: "warning",
});

target.finish?.();

const mb = (fs.statSync(target.outFile).size / 1e6).toFixed(1);
console.log(`${name}: ${path.relative(REPO_ROOT, target.outFile)}, ${library.games.length} items built ${library.builtAt}, ${mb} MB`);
