import type { FastifyInstance } from "fastify";
import { PLATFORM_FILTERS, type DealsQuery, type DealsResponse, type FiltersResponse, type Game, type GamesLookup, type GamesQuery, type GamesResponse } from "@ugs/shared";
import { queryDeals } from "../deals.ts";
import type { LibrarySnapshot } from "../library.ts";
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

// The same query in a JSON body, limited to a reader's wishlist or collection.
const lookupBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["ids"],
  properties: {
    ...gamesQuerySchema.properties,
    ids: { type: "array", maxItems: 2000, items: { type: "string", maxLength: 200 } },
  },
} as const;

const dealsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    platform: gamesQuerySchema.properties.platform,
    condition: gamesQuerySchema.properties.condition,
    limit: { type: "integer", minimum: 1, maximum: 60, default: 36 },
  },
} as const;

export function gamesRoutes(app: FastifyInstance, { library }: { library: () => LibrarySnapshot }) {
  app.get<{ Querystring: GamesQuery }>("/api/games", { schema: { querystring: gamesQuerySchema } }, async (req): Promise<GamesResponse> =>
    queryGames(library(), req.query),
  );

  app.post<{ Body: GamesLookup }>("/api/games/lookup", { schema: { body: lookupBodySchema } }, async (req): Promise<GamesResponse> =>
    queryGames(library(), req.body),
  );

  app.get<{ Params: { id: string } }>("/api/games/:id", async (req, reply): Promise<Game> => {
    const game = library().byId.get(req.params.id);
    if (!game) return reply.code(404).send({ error: "Not Found", message: `No game with id "${req.params.id}"` });
    const { searchText, inStockSince, ...rest } = game;
    return rest;
  });

  app.get<{ Querystring: DealsQuery }>("/api/deals", { schema: { querystring: dealsQuerySchema } }, async (req): Promise<DealsResponse> =>
    queryDeals(library(), req.query),
  );

  app.get("/api/filters", async (): Promise<FiltersResponse> => libraryFilters(library()));
}
