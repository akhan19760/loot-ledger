import type { FastifyInstance } from "fastify";
import { PLATFORM_FILTERS, type FiltersResponse, type Game, type GamesQuery, type GamesResponse } from "@ugs/shared";
import type { Db } from "../db/client.ts";
import { getLibrary } from "../library.ts";
import { libraryFilters, queryGames } from "../query.ts";

// Defaults match what the old page showed first: PlayStation games in stock, cheapest first.
const gamesQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: { type: "string", maxLength: 100, default: "" },
    genre: { type: "string", maxLength: 50, default: "" },
    store: { type: "string", maxLength: 50, default: "" },
    platform: { type: "string", enum: ["", ...PLATFORM_FILTERS], default: "PS" },
    condition: { type: "string", enum: ["", "new", "used"], default: "" },
    kind: { type: "string", enum: ["", "game", "hardware", "giftcard", "other"], default: "game" },
    inStock: { type: "boolean", default: true },
    sort: { type: "string", enum: ["price", "spread", "stores", "az"], default: "price" },
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 200, default: 60 },
  },
} as const;

export function gamesRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get<{ Querystring: GamesQuery }>("/api/games", { schema: { querystring: gamesQuerySchema } }, async (req): Promise<GamesResponse> =>
    queryGames(getLibrary(db), req.query),
  );

  app.get<{ Params: { id: string } }>("/api/games/:id", async (req, reply): Promise<Game> => {
    const game = getLibrary(db).byId.get(req.params.id);
    if (!game) return reply.code(404).send({ error: "Not Found", message: `No game with id "${req.params.id}"` });
    const { searchText, ...rest } = game;
    return rest;
  });

  app.get("/api/filters", async (): Promise<FiltersResponse> => libraryFilters(getLibrary(db)));
}
