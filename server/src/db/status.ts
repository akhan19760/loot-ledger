import { count, desc, eq } from "drizzle-orm";
import type { RefreshRun, RunType, StatusResponse } from "@ugs/shared";
import { runningJob } from "../jobs/refresh.ts";
import type { Db } from "./client.ts";
import { libraryBuiltAt } from "./library.ts";
import { games, listings, refreshRuns, stores } from "./schema.ts";

const RECENT_RUNS = 20;

/** When each refresh job runs (the Node server's scheduler, or the deploy workflow's). */
export interface StatusSchedule {
  timezone: string;
  jobs: Record<RunType, { cron: string; next: () => Date | null }>;
}

/** What /api/status reports: schedules, recent refresh runs, per-store fetch status. */
export function readStatus(db: Db, schedule: StatusSchedule): StatusResponse {
  const lastRun = (type: RunType) =>
    (db.select().from(refreshRuns).where(eq(refreshRuns.type, type)).orderBy(desc(refreshRuns.id)).limit(1).get() as RefreshRun | undefined) ?? null;
  const job = (type: RunType) => ({
    cron: schedule.jobs[type].cron,
    nextRun: schedule.jobs[type].next()?.toISOString() ?? null,
    lastRun: lastRun(type),
  });
  return {
    running: runningJob(),
    schedule: { timezone: schedule.timezone, jobs: { prices: job("prices"), genres: job("genres") } },
    recentRuns: db.select().from(refreshRuns).orderBy(desc(refreshRuns.id)).limit(RECENT_RUNS).all() as RefreshRun[],
    stores: db
      .select({ id: stores.id, name: stores.name, lastFetchedAt: stores.lastFetchedAt, lastStatus: stores.lastStatus, lastError: stores.lastError })
      .from(stores)
      .all(),
    library: {
      builtAt: libraryBuiltAt(db),
      games: db.select({ n: count() }).from(games).get()!.n,
      listings: db.select({ n: count() }).from(listings).get()!.n,
    },
  };
}
