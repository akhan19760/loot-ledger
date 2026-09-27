import { Cron } from "croner";
import { count, eq, isNull, ne } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { games, rawFeeds, stores } from "../db/schema.ts";
import { rebuildLibrary } from "./rebuild.ts";
import { refreshGenres, refreshPrices, type RefreshContext, type RunType } from "./refresh.ts";

export interface ScheduleOptions {
  prices: string;
  genres: string;
  timezone?: string;
}

export interface Scheduler {
  timezone: string;
  jobs: Record<RunType, { cron: string; next: () => Date | null }>;
  stop(): void;
}

/** Run the refresh jobs on their cron schedules. Throws on an invalid cron expression. */
export function startScheduler(ctx: RefreshContext, options: ScheduleOptions): Scheduler {
  const make = (type: RunType, pattern: string, run: () => Promise<unknown>) =>
    new Cron<undefined>(pattern, {
      name: type,
      timezone: options.timezone,
      // Skip a tick while the previous run of this job is still going.
      protect: () => ctx.log.warn(`${type} refresh: previous run still going, skipping this tick`),
      catch: (err) => ctx.log.error(`${type} refresh crashed: ${(err as Error).stack ?? err}`),
    }, async () => void (await run()));

  const cron = {
    prices: make("prices", options.prices, () => refreshPrices(ctx)),
    genres: make("genres", options.genres, () => refreshGenres(ctx)),
  };
  for (const [type, job] of Object.entries(cron))
    ctx.log.info(`${type} refresh scheduled "${job.getPattern()}", next at ${job.nextRun()?.toISOString() ?? "never"}`);

  return {
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    jobs: {
      prices: { cron: options.prices, next: () => cron.prices.nextRun() },
      genres: { cron: options.genres, next: () => cron.genres.nextRun() },
    },
    stop: () => Object.values(cron).forEach((job) => job.stop()),
  };
}

/**
 * Startup catch-up, so a fresh install doesn't wait hours for its first data.
 * "if-empty": fetch stores that were never fetched and the genre list if missing,
 * or just rebuild if feeds exist but the library is empty. "always": fetch all stores.
 */
export async function refreshOnStart(ctx: RefreshContext, mode: "if-empty" | "always" | "never") {
  if (mode === "never") return;
  const { db, log } = ctx;
  const neverFetched = db.select({ id: stores.id }).from(stores).where(isNull(stores.lastFetchedAt)).all().map((s) => s.id);
  const hasGenres = db.select({ n: count() }).from(rawFeeds).where(eq(rawFeeds.sourceId, "wikidata")).get()!.n > 0;

  let rebuilt = false;
  if (mode === "always" || neverFetched.length) {
    log.info(mode === "always" ? "startup refresh: all stores" : `startup refresh: never fetched: ${neverFetched.join(", ")}`);
    const outcome = await refreshPrices(ctx, mode === "always" ? undefined : neverFetched);
    rebuilt = !outcome.skipped && outcome.status !== "failed";
  }
  if (!hasGenres) {
    log.info("startup refresh: genre list missing");
    const outcome = await refreshGenres(ctx);
    rebuilt ||= !outcome.skipped && outcome.status !== "failed";
  }
  if (!rebuilt && libraryIsEmpty(db) && hasAnyStoreFeed(db)) {
    log.info("startup: library empty, rebuilding from stored feeds");
    for (const line of rebuildLibrary(db, ctx.storeOrder).stats) log.info(line);
  }
}

const libraryIsEmpty = (db: Db) => db.select({ n: count() }).from(games).get()!.n === 0;
const hasAnyStoreFeed = (db: Db) => db.select({ n: count() }).from(rawFeeds).where(ne(rawFeeds.sourceId, "wikidata")).get()!.n > 0;
