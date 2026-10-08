/**
 * The API as a serverless function, on any host that can run one. The routes are the
 * Node server's own (src/app.ts), but the data is a snapshot baked in at deploy time,
 * because a serverless host can't run the scheduler or keep a SQLite file: the deploy
 * workflow (.github/workflows/deploy.yml) does the refreshing and
 * scripts/build-function.ts bakes the built library and the refresh status in. The
 * data is read-only until the next deploy.
 *
 * Only two things differ between hosts — the header their CDN reads, and where the
 * visitor's IP comes from — and both live in a HostAdapter in src/hosts/. Everything
 * here is the same everywhere.
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

/**
 * What one host does differently. `Context` is whatever the host passes the function
 * alongside the request, or `unknown` for a host that passes nothing.
 */
export interface HostAdapter<Context = unknown> {
  /** The response header this host's CDN reads, separately from the browser's Cache-Control. */
  cdnCacheHeader: string;
  /** This host's spelling of "the CDN may keep this response for `seconds`". */
  cacheFor: (seconds: number) => string;
  /** The visitor's IP: rate limits are per visitor, not per function instance. */
  clientIp: (req: Request, context: Context) => string;
}

const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding"]);

const A_YEAR = 31536000;

// Every deploy starts the host's CDN cache afresh and the data only changes with a
// deploy, so library answers stay cached until the next one. Status says when the next
// refresh is due, so it is only cached for a minute; health and lookups (a reader's own
// wishlist or collection) are never cached.
/** How long the CDN may keep this response, in seconds, or null to never cache it. */
function cdnTtl(method: string, path: string, status: number): number | null {
  if ((method !== "GET" && method !== "HEAD") || path === "/api/health" || (status !== 200 && status !== 404)) return null;
  if (path === "/api/status") return 60;
  return A_YEAR;
}

const nextRun = (cron: string, timezone: string) => new Cron(cron, { timezone }).nextRun()?.toISOString() ?? null;

export function createHandler<Context>(snapshot: Snapshot, rateLimit: { max: number; timeWindow: string }, host: HostAdapter<Context>) {
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

  return async (req: Request, context: Context): Promise<Response> => {
    const url = new URL(req.url);
    const res = await (await app).inject({
      method: req.method as InjectOptions["method"],
      url: url.pathname + url.search,
      // Share pages link back to the site by its public address.
      headers: { "x-forwarded-proto": url.protocol.slice(0, -1), "x-forwarded-host": url.host, ...Object.fromEntries(req.headers) },
      remoteAddress: host.clientIp(req, context),
      ...(req.body && { payload: Buffer.from(await req.arrayBuffer()) }),
    });

    const headers = new Headers();
    for (const [name, value] of Object.entries(res.headers)) {
      if (HOP_BY_HOP.has(name)) continue;
      for (const v of [value ?? []].flat()) headers.append(name, String(v));
    }
    const ttl = cdnTtl(req.method, url.pathname, res.statusCode);
    headers.set(host.cdnCacheHeader, ttl === null ? "no-store" : host.cacheFor(ttl));
    return new Response(req.method === "HEAD" ? null : res.body, { status: res.statusCode, headers });
  };
}
