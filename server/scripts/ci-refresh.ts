/**
 * The refresh step of the deploy workflow (.github/workflows/deploy.yml).
 *
 * The DB comes from the Actions cache, which can be empty (the first run, or after
 * GitHub evicts it), so this first fetches anything never fetched, then runs the
 * requested job, then rebuilds the library so a deploy of new catalog rules
 * applies them to the current data.
 *
 * Usage:  pnpm --filter @ugs/server refresh:ci none|prices|genres|all
 */
import { config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { libraryBuiltAt } from "../src/db/library.ts";
import { syncStores } from "../src/db/stores.ts";
import { rebuildLibrary } from "../src/jobs/rebuild.ts";
import { refreshGenres, refreshPrices, type RefreshContext, type RunOutcome } from "../src/jobs/refresh.ts";
import { hasGenreList, neverFetchedStores } from "../src/jobs/scheduler.ts";

const MODES = ["none", "prices", "genres", "all"];
const mode = process.argv[2] ?? "none";
if (!MODES.includes(mode)) {
  console.error(`unknown mode "${mode}": use ${MODES.join(", ")}`);
  process.exit(2);
}

const db = openDb(config.DB_PATH);
const ctx: RefreshContext = { db, storeOrder: syncStores(db, config.STORES_FILE), fetchDelayMs: config.FETCH_DELAY_MS, log: console };
const builtBefore = libraryBuiltAt(db);

// "::warning::" lines show up on the workflow run's summary page.
let fetched = false;
const report = (job: string, outcome: RunOutcome) => {
  fetched ||= !outcome.skipped && outcome.status !== "failed";
  if (!outcome.skipped && outcome.status !== "ok")
    console.log(`::warning::${job} refresh #${outcome.runId} ${outcome.status}: failed sources keep their previous data (details in the log)`);
};

const neverFetched = neverFetchedStores(db);
if (mode === "prices" || mode === "all") report("prices", await refreshPrices(ctx));
else if (neverFetched.length) report("prices", await refreshPrices(ctx, neverFetched));
if (mode === "genres" || mode === "all" || !hasGenreList(db)) report("genres", await refreshGenres(ctx));

// Without new data, keep the old build time: the site shows it as "Updated … ago".
for (const line of rebuildLibrary(db, ctx.storeOrder, fetched ? undefined : (builtBefore ?? undefined)).stats) console.log(line);
db.$client.close(); // folds the WAL into the file before the Actions cache saves it
