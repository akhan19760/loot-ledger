/**
 * Download game titles + genres from Wikidata.
 *
 * Store feeds don't say what genre a game is, so the build looks each game up in
 * this list. Wikidata is free and needs no API key.
 */
import type { WikidataGames } from "../catalog/genres.ts";
import { getJson, sleep, type Log } from "./http.ts";

const UA = "personal-game-library/0.1 (hobby price-comparison project)";

const PLATFORMS: Record<string, string> = { // Wikidata item ids
  PS5: "Q63184502",
  PS4: "Q5014725",
  PS3: "Q10683",
  Switch: "Q19610114",
  "Xbox One": "Q13361286",
};

// Many well-known games only have a language-neutral "mul" label (e.g. "Gran Turismo 7"),
// so accept both "en" and "mul".
const query = (platformId: string) => `
SELECT ?g (SAMPLE(?label) AS ?label) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres) WHERE {
  ?g wdt:P400 wd:${platformId} ; wdt:P31 wd:Q7889 ; rdfs:label ?label .
  FILTER(lang(?label) IN ("en", "mul"))
  OPTIONAL { ?g skos:altLabel ?alt . FILTER(lang(?alt) IN ("en", "mul")) }
  OPTIONAL { ?g wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(lang(?genreLabel) IN ("en", "mul")) }
} GROUP BY ?g
`;

type Binding = Record<"g" | "label" | "alts" | "genres", { value: string }>;

const mergeSorted = (a: string[], b: string) => [...new Set([...a, ...b.split("|").filter(Boolean)])].sort();

export async function fetchWikidataGames(log: Log): Promise<WikidataGames> {
  const games: WikidataGames = {};
  for (const [name, id] of Object.entries(PLATFORMS)) {
    const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query(id));
    const { results } = await getJson<{ results: { bindings: Binding[] } }>(url, { userAgent: UA, timeoutMs: 180_000, tries: 1, log });
    for (const r of results.bindings) {
      const gid = r.g.value.split("/").at(-1)!;
      const g = (games[gid] ??= { label: r.label.value, alts: [], genres: [] });
      g.alts = mergeSorted(g.alts, r.alts.value);
      g.genres = mergeSorted(g.genres, r.genres.value);
    }
    log.info(`  ${name}: ${results.bindings.length}`);
    await sleep(2_000);
  }
  return games;
}
