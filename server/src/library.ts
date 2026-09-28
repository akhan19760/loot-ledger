/**
 * The built library as the games API sees it. No database access here, so the
 * same routes can run from the DB (src/index.ts) or from a snapshot baked at
 * deploy time (src/netlify.ts); db/library.ts loads it from the DB.
 */
import type { Game, Store } from "@ugs/shared";

export interface IndexedGame extends Game {
  /** normalizeSearch(title + every store's raw title). */
  searchText: string;
}

/** The library as stored: plain data, so it can be written out as JSON. */
export interface LibraryData {
  builtAt: string | null;
  stores: Store[];
  /** In library order (by title), as built. */
  games: IndexedGame[];
}

export interface LibrarySnapshot extends LibraryData {
  byId: Map<string, IndexedGame>;
}

export const indexLibrary = (data: LibraryData): LibrarySnapshot => ({ ...data, byId: new Map(data.games.map((g) => [g.id, g])) });
