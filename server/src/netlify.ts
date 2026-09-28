/**
 * The API as a Netlify Function. Netlify can't keep the Node server, its scheduler
 * or a SQLite file running, so the deploy workflow (.github/workflows/deploy.yml)
 * does the refreshing and scripts/build-netlify.ts bakes the built library and the
 * refresh status into the function. The routes are the Node server's own; the data
 * is read-only until the next deploy.
 */
import { Cron } from "croner";
import type { InjectOptions } from "fastify";
import type { StatusResponse } from "@ugs/shared";
import { buildApp } from "./app.ts";
import { indexLibrary, type LibraryData } from "./library.ts";

export interface Snapshot {
  library: LibraryData;
  /** /api/status as it was at deploy time; the next run times are worked out per request. */
  status: StatusResponse;
}

/** The part of Netlify's function context used here. */
export interface NetlifyContext {
  /** The visitor's IP address. */
  ip: string;
}

const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding"]);

// Every deploy clears Netlify's CDN cache and the data only changes with a deploy,
// so library answers stay cached until the next one. Status says when the next
// refresh is due, so it is only cached for a minute; health and lookups (a reader's
// own wishlist or collection) are never cached.
function cdnCache(method: string, path: string, status: number): string {
  if ((method !== "GET" && method !== "HEAD") || path === "/api/health" || (status !== 200 && status !== 404)) return "no-store";
  if (path === "/api/status") return "public, durable, max-age=60";
  return "public, durable, max-age=31536000";
}

const nextRun = (cron: string, timezone: string) => new Cron(cron, { timezone }).nextRun()?.toISOString() ?? null;

export function createHandler(snapshot: Snapshot, rateLimit: { max: number; timeWindow: string }) {
  const library = indexLibrary(snapshot.library);
  const { schedule } = snapshot.status;
  const status = (): StatusResponse => ({
    ...snapshot.status,
    schedule: {
      ...schedule,
      jobs: {
        prices: { ...schedule.jobs.prices, nextRun: nextRun(schedule.jobs.prices.cron, schedule.timezone) },
        genres: { ...schedule.jobs.genres, nextRun: nextRun(schedule.jobs.genres.cron, schedule.timezone) },
      },
    },
  });
  const app = buildApp({ library: () => library, status }, { logger: false, rateLimit });

  return async (req: Request, context: NetlifyContext): Promise<Response> => {
    const url = new URL(req.url);
    const res = await (await app).inject({
      method: req.method as InjectOptions["method"],
      url: url.pathname + url.search,
      headers: Object.fromEntries(req.headers),
      remoteAddress: context.ip, // rate limits are per visitor, not per function instance
      ...(req.body && { payload: Buffer.from(await req.arrayBuffer()) }),
    });

    const headers = new Headers();
    for (const [name, value] of Object.entries(res.headers)) {
      if (HOP_BY_HOP.has(name)) continue;
      for (const v of [value ?? []].flat()) headers.append(name, String(v));
    }
    headers.set("Netlify-CDN-Cache-Control", cdnCache(req.method, url.pathname, res.statusCode));
    return new Response(req.method === "HEAD" ? null : res.body, { status: res.statusCode, headers });
  };
}
