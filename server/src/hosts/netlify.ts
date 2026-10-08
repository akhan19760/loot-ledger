/**
 * Netlify. Its CDN reads Netlify-CDN-Cache-Control, which browsers never see, so the
 * browser's own Cache-Control is left to the routes; `durable` keeps one copy for the
 * whole network instead of one per edge location. The visitor's IP is on the context
 * Netlify passes the function.
 *
 * The rest of the site's routing is in netlify.toml, next to the function's own
 * `config.path` (scripts/build-function.ts).
 */
import type { HostAdapter } from "../serverless.ts";

/** The part of Netlify's function context used here. */
export interface NetlifyContext {
  /** The visitor's IP address. */
  ip: string;
}

export const netlify: HostAdapter<NetlifyContext> = {
  cdnCacheHeader: "Netlify-CDN-Cache-Control",
  cacheFor: (seconds) => `public, durable, max-age=${seconds}`,
  clientIp: (_req, context) => context.ip,
};
