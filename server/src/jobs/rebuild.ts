import { buildLibrary, libraryStats } from "../catalog/build.ts";
import type { Db } from "../db/client.ts";
import { loadBuildInput, saveLibrary } from "../db/library.ts";

/** Rebuild games + listings from the stored raw feeds (no fetching). */
export function rebuildLibrary(db: Db, storeOrder: string[]) {
  const lib = buildLibrary(loadBuildInput(db, storeOrder));
  saveLibrary(db, lib);
  return { lib, stats: libraryStats(lib) };
}
