import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { StatusResponse } from "@ugs/shared";
import type { LibrarySnapshot } from "./library.ts";
import { gamesRoutes } from "./routes/games.ts";
import { metaRoutes } from "./routes/meta.ts";
import { shareRoutes } from "./routes/share.ts";

/** Where the API's data comes from: the DB (Node server) or a deploy snapshot (Netlify). */
export interface ApiSources {
  library: () => LibrarySnapshot;
  status: () => StatusResponse;
}

export interface ApiOptions {
  logger: FastifyServerOptions["logger"];
  /** Requests allowed per client IP per window. */
  rateLimit: { max: number; timeWindow: string };
}

/** The HTTP API: /api/health, /api/status, /api/games, POST /api/games/lookup, /api/games/:id, /api/filters, /api/deals. */
export async function buildApp(sources: ApiSources, options: ApiOptions) {
  const app = Fastify({ logger: options.logger });
  // Per client IP. Responses carry x-ratelimit-* headers; over the limit gets a 429.
  await app.register(rateLimit, options.rateLimit);
  metaRoutes(app, sources);
  gamesRoutes(app, sources);
  shareRoutes(app, sources); // /g/:slug, a game's share link (a page, not JSON)
  return app;
}
