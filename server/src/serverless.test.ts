import { describe, expect, it } from "vitest";
import { normalizeSearch, type GamesResponse, type Listing, type StatusResponse } from "@ugs/shared";
import type { IndexedGame } from "./library.ts";
import { netlify } from "./hosts/netlify.ts";
import { createHandler, type Snapshot } from "./serverless.ts";

const offer = (store: string, platform: string, price: number): Listing => ({
  store, raw_title: "", variant: "", platform, condition: "new", format: "disc", price, was: null, in_stock: true, url: "",
});
const game = (id: string, title: string, listings: Listing[]): IndexedGame => ({
  id, title, kind: "game", genres: [], image: null, listings, searchText: normalizeSearch(title), inStockSince: null,
});

const snapshot: Snapshot = {
  library: {
    builtAt: "2026-09-28T06:00:00.000Z",
    pricesAt: "2026-09-28T06:00:00.000Z",
    stores: [{ id: "a", name: "Store A", base: "https://a", fetched_at: "2026-09-28T06:00:00.000Z" }],
    games: [game("game:elden-ring", "Elden Ring", [offer("a", "PS5", 9000)]), game("game:halo", "Halo", [offer("a", "Xbox One", 5000)])],
  },
  status: {
    running: null,
    schedule: {
      timezone: "UTC",
      jobs: { prices: { cron: "0 */6 * * *", nextRun: null, lastRun: null }, genres: { cron: "0 4 1 * *", nextRun: null, lastRun: null } },
    },
    recentRuns: [],
    stores: [],
    library: { builtAt: "2026-09-28T06:00:00.000Z", games: 2, listings: 2 },
  },
};

const handler = createHandler(snapshot, { max: 3, timeWindow: "1 minute" }, netlify);
const get = (path: string, ip = "203.0.113.1") => handler(new Request(`https://lootledger.example${path}`), { ip });
const cdn = (res: Response) => res.headers.get("netlify-cdn-cache-control");

describe("the serverless API on Netlify", () => {
  it("serves the games API from the snapshot, cached on the CDN until the next deploy", async () => {
    const res = await get("/api/games?platform=PS5");
    expect(res.status).toBe(200);
    expect(((await res.json()) as GamesResponse).items.map((g) => g.id)).toEqual(["game:elden-ring"]);
    expect(cdn(res)).toBe("public, durable, max-age=31536000");
  });

  it("finds a game by its encoded id, without the search index", async () => {
    const res = await get("/api/games/game%3Aelden-ring", "203.0.113.2");
    expect(await res.json()).toMatchObject({ id: "game:elden-ring", title: "Elden Ring" });
    expect(await (await get("/api/games/game%3Anope", "203.0.113.2")).json()).toMatchObject({ error: "Not Found" });
  });

  it("looks up a reader's games by POST, never cached", async () => {
    const res = await handler(
      new Request("https://lootledger.example/api/games/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["game:halo", "game:gone"], platform: "" }),
      }),
      { ip: "203.0.113.9" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ items: [{ id: "game:halo" }], missing: ["game:gone"], inStock: { games: 1, cheapestSum: 5000 } });
    expect(cdn(res)).toBe("no-store");
  });

  it("rejects bad queries without caching them", async () => {
    const res = await get("/api/games?pageSize=999", "203.0.113.3");
    expect(res.status).toBe(400);
    expect(cdn(res)).toBe("no-store");
  });

  it("works out the next scheduled refresh per request", async () => {
    const res = await get("/api/status", "203.0.113.4");
    const status = (await res.json()) as StatusResponse;
    const next = status.schedule.jobs.prices.nextRun!;
    expect(new Date(next).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(next).getUTCHours() % 6).toBe(0);
    expect(cdn(res)).toBe("public, durable, max-age=60");
  });

  it("serves a share link as link-preview tags that send people on to the game", async () => {
    const res = await get("/g/elden-ring", "203.0.113.10");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Elden Ring: Rs 9,000 at Store A">');
    expect(html).toContain('<meta property="og:url" content="https://lootledger.example/g/elden-ring">');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=/?game=game%3Aelden-ring">');
    expect(cdn(res)).toBe("public, durable, max-age=31536000");
  });

  it("sends a share link to a game that's gone to the home page", async () => {
    const res = await get("/g/nope", "203.0.113.11");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('content="0; url=/"');
  });

  it("never caches health", async () => {
    expect(cdn(await get("/api/health", "203.0.113.5"))).toBe("no-store");
  });

  it("rate-limits each visitor on their own", async () => {
    const ip = "203.0.113.6";
    for (let i = 0; i < 3; i++) expect((await get("/api/filters", ip)).status).toBe(200);
    const limited = await get("/api/filters", ip);
    expect(limited.status).toBe(429);
    expect(cdn(limited)).toBe("no-store");
    expect((await get("/api/filters", "203.0.113.7")).status).toBe(200);
  });
});
