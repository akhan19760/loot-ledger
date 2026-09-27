/**
 * Refresh jobs: fetch fresh feeds, store them, rebuild the library, and log the
 * run in refresh_runs. Only one job runs at a time; a job that is asked to start
 * while another is running is skipped (the next scheduled run picks it up).
 */
import { eq, inArray } from "drizzle-orm";
import type { StoreConfig } from "../catalog/adapters.ts";
import type { Db } from "../db/client.ts";
import { rawFeeds, refreshRuns, stores } from "../db/schema.ts";
import type { Log } from "../ingest/http.ts";
import { fetchStore } from "../ingest/stores.ts";
import { fetchWikidataGames } from "../ingest/wikidata.ts";
import { rebuildLibrary } from "./rebuild.ts";

export type RunType = "prices" | "genres";
type RunStatus = "ok" | "partial" | "failed";
type SourceResult = { ok: true; count: number; ms: number } | { ok: false; error: string; ms: number };

export interface RefreshContext {
  db: Db;
  /** Store ids in stores.json order. */
  storeOrder: string[];
  fetchDelayMs: number;
  log: Log;
}

export type RunOutcome = { skipped: true; running: RunType } | { skipped: false; runId: number; status: RunStatus };

let current: RunType | null = null;

/** Which job is running right now, if any. */
export const runningJob = () => current;

async function exclusive(type: RunType, ctx: RefreshContext, work: (results: Record<string, SourceResult>) => Promise<void>): Promise<RunOutcome> {
  if (current) {
    ctx.log.warn(`${type} refresh skipped: ${current} refresh still running`);
    return { skipped: true, running: current };
  }
  current = type;
  const { db, log } = ctx;
  const run = db.insert(refreshRuns).values({ type, startedAt: now(), status: "running" }).returning({ id: refreshRuns.id }).get();
  const results: Record<string, SourceResult> = {};
  let status: RunStatus = "failed";
  let error: string | null = null;
  try {
    await work(results);
    const failed = Object.values(results).filter((r) => !r.ok).length;
    status = failed === 0 ? "ok" : failed < Object.keys(results).length ? "partial" : "failed";
    if (status !== "failed") {
      const { stats } = rebuildLibrary(db, ctx.storeOrder);
      for (const line of stats) log.info(line);
    }
  } catch (err) {
    status = "failed";
    error = (err as Error).stack ?? String(err);
    log.error(`${type} refresh failed: ${error}`);
  } finally {
    db.update(refreshRuns).set({ finishedAt: now(), status, results, error }).where(eq(refreshRuns.id, run.id)).run();
    current = null;
  }
  log.info(`${type} refresh #${run.id} finished: ${status}`);
  return { skipped: false, runId: run.id, status };
}

const now = () => new Date().toISOString();

function saveFeed(db: Pick<Db, "insert">, sourceId: string, payload: unknown, itemCount: number, fetchedAt: string) {
  const row = { fetchedAt, itemCount, payload };
  db.insert(rawFeeds).values({ sourceId, ...row }).onConflictDoUpdate({ target: rawFeeds.sourceId, set: row }).run();
}

/**
 * Fetch store feeds (all stores, or only `only`) and rebuild. A store that fails
 * keeps its previous feed, so its listings stay in the library.
 */
export function refreshPrices(ctx: RefreshContext, only?: string[]): Promise<RunOutcome> {
  return exclusive("prices", ctx, async (results) => {
    const { db, log } = ctx;
    const rows = db.select().from(stores).where(only ? inArray(stores.id, only) : undefined).all();
    const byId = new Map(rows.map((s) => [s.id, s]));
    const targets = ctx.storeOrder.flatMap((id) => byId.get(id) ?? []);
    if (!targets.length) throw new Error(`no stores to refresh${only ? ` (asked for: ${only.join(", ")})` : ""}`);

    for (const s of targets) {
      const store: StoreConfig = { id: s.id, name: s.name, platform: s.platform, base: s.base, linkStyle: s.linkStyle };
      log.info(`${store.name} (${store.base})`);
      const t0 = performance.now();
      try {
        const products = await fetchStore(store, { delayMs: ctx.fetchDelayMs, log });
        const fetchedAt = now();
        db.transaction((tx) => {
          saveFeed(tx, store.id, products, products.length, fetchedAt);
          tx.update(stores).set({ lastFetchedAt: fetchedAt, lastStatus: "ok", lastError: null }).where(eq(stores.id, store.id)).run();
        });
        results[store.id] = { ok: true, count: products.length, ms: Math.round(performance.now() - t0) };
        log.info(`  saved ${products.length} products`);
      } catch (err) {
        const message = (err as Error).message;
        db.update(stores).set({ lastStatus: "failed", lastError: message }).where(eq(stores.id, store.id)).run();
        results[store.id] = { ok: false, error: message, ms: Math.round(performance.now() - t0) };
        log.error(`  FAILED: ${message} (keeping previous data, if any)`);
      }
    }
  });
}

/** Fetch the Wikidata genre list and rebuild. On failure the previous list is kept. */
export function refreshGenres(ctx: RefreshContext): Promise<RunOutcome> {
  return exclusive("genres", ctx, async (results) => {
    const t0 = performance.now();
    try {
      const games = await fetchWikidataGames(ctx.log);
      const count = Object.keys(games).length;
      saveFeed(ctx.db, "wikidata", games, count, now());
      results.wikidata = { ok: true, count, ms: Math.round(performance.now() - t0) };
      ctx.log.info(`saved ${count} games from Wikidata`);
    } catch (err) {
      results.wikidata = { ok: false, error: (err as Error).message, ms: Math.round(performance.now() - t0) };
      ctx.log.error(`  FAILED: ${(err as Error).message} (keeping previous genre list, if any)`);
    }
  });
}

/** Runs left "running" by a server that stopped mid-run. */
export function markInterruptedRuns(db: Db) {
  db.update(refreshRuns)
    .set({ status: "failed", finishedAt: now(), error: "interrupted: server stopped during the run" })
    .where(eq(refreshRuns.status, "running"))
    .run();
}
