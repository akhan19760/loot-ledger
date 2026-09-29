import type { FastifyInstance, FastifyRequest } from "fastify";
import { idFromShareSlug, sharePath, shareText } from "@ugs/shared";
import type { LibrarySnapshot } from "../library.ts";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The site's address as the visitor used it (behind Netlify or the Vite proxy, from the forwarded headers). */
function origin(req: FastifyRequest): string {
  const first = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h?.split(",")[0])?.trim();
  const proto = first(req.headers["x-forwarded-proto"]) ?? "http";
  const host = first(req.headers["x-forwarded-host"]) ?? req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

/** Shopify resizes on request; a 600px cover stays well under what chat apps accept for a preview. */
const previewImage = (url: string) => {
  if (!url.startsWith("https://cdn.shopify.com/")) return url;
  const u = new URL(url);
  u.searchParams.set("width", "600");
  return u.toString();
};

/**
 * A page that only link previews read: title, description and cover as Open Graph
 * tags (WhatsApp, Facebook, X and the like don't run the app), then straight on to
 * the game in the app for people.
 */
function page({ title, description, image, url, to }: { title: string; description: string; image: string | null; url: string; to: string }) {
  const meta = (attr: "property" | "name", key: string, value: string) => `<meta ${attr}="${key}" content="${escape(value)}">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
${meta("name", "description", description)}
<link rel="canonical" href="${escape(url)}">
${meta("property", "og:site_name", "LootLedger")}
${meta("property", "og:type", "website")}
${meta("property", "og:url", url)}
${meta("property", "og:title", title)}
${meta("property", "og:description", description)}
${image ? meta("property", "og:image", image) : ""}
${meta("name", "twitter:card", image ? "summary_large_image" : "summary")}
<meta http-equiv="refresh" content="0; url=${escape(to)}">
<script>location.replace(${JSON.stringify(to).replace(/</g, "\\u003c")})</script>
</head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif">
<p><a href="${escape(to)}" style="color:#d4fb08">${escape(title)}</a></p>
</body>
</html>
`;
}

/** GET /g/:slug, the link people share (see sharePath). */
export function shareRoutes(app: FastifyInstance, { library }: { library: () => LibrarySnapshot }) {
  app.get<{ Params: { slug: string } }>("/g/:slug", async (req, reply) => {
    const lib = library();
    const game = lib.byId.get(idFromShareSlug(req.params.slug));
    const site = origin(req);
    reply.type("text/html; charset=utf-8");
    if (!game) {
      return reply.code(404).send(
        page({ title: "LootLedger", description: "That game isn't in the library any more. Compare Pakistani game store prices on LootLedger.", image: null, url: site, to: "/" }),
      );
    }
    const names = new Map(lib.stores.map((s) => [s.id, s.name]));
    const { title, description } = shareText(game, (id) => names.get(id) ?? id);
    return page({
      title,
      description,
      image: game.image && previewImage(game.image),
      url: site + sharePath(game.id),
      to: `/?${new URLSearchParams({ game: game.id })}`,
    });
  });
}
