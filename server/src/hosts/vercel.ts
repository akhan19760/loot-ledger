/**
 * Vercel. Its CDN reads CDN-Cache-Control (returned to the browser, which ignores it,
 * and honoured by any CDN in front) and only caches a function's response when it is
 * told an `s-maxage`. Cache entries belong to the deployment that produced them, so a
 * deploy starts cold, as on Netlify.
 *
 * A Web handler is called with the request and nothing else, so the visitor's IP comes
 * from the headers Vercel's proxy adds: the first entry of x-forwarded-for is the
 * client as the proxy saw it. Falling back to no address at all puts every visitor in
 * one rate-limit bucket, which is the safe way to be wrong.
 *
 * The rest of the site's routing is the config.json that scripts/build-function.ts
 * writes, which is what netlify.toml is for Netlify.
 */
import type { HostAdapter } from "../serverless.ts";

export const vercel: HostAdapter = {
  cdnCacheHeader: "CDN-Cache-Control",
  cacheFor: (seconds) => `public, s-maxage=${seconds}`,
  clientIp: (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "",
};
