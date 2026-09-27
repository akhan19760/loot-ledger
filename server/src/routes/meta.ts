import { count, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { HealthResponse, RefreshRun, RunType, StatusResponse } from "@ugs/shared";
import type { Db } from "../db/client.ts";
import { libraryBuiltAt } from "../db/library.ts";
import { games, listings, refreshRuns, stores } from "../db/schema.ts";
import { runningJob } from "../jobs/refresh.ts";
import type { Scheduler } from "../jobs/scheduler.ts";

const RECENT_RUNS = 20;

export function metaRoutes(app: FastifyInstance, { db, scheduler }: { db: Db; scheduler: Scheduler }) {
  app.get("/api/health", async (): Promise<HealthResponse> => ({ ok: true, time: new Date().toISOString() }));

  app.get("/api/status", async (): Promise<StatusResponse> => {
    const lastRun = (type: RunType) =>
      (db.select().from(refreshRuns).where(eq(refreshRuns.type, type)).orderBy(desc(refreshRuns.id)).limit(1).get() as RefreshRun | undefined) ?? null;
    const job = (type: RunType) => ({
      cron: scheduler.jobs[type].cron,
      nextRun: scheduler.jobs[type].next()?.toISOString() ?? null,
      lastRun: lastRun(type),
    });
    return {
      running: runningJob(),
      schedule: { timezone: scheduler.timezone, jobs: { prices: job("prices"), genres: job("genres") } },
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
  });
}
