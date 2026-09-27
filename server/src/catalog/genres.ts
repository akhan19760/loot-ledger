// Genres come from Wikidata (see ingest/wikidata.ts), matched to games by title key.
import { pyRegex } from "./pyregex.ts";
import { cleanTitle, gameKey } from "./titles.ts";

const rx = (pattern: string) => pyRegex(pattern, "i");

/** raw_feeds "wikidata" payload: Wikidata item id -> labels and genre names. */
export type WikidataGames = Record<string, { label: string; alts: string[]; genres: string[] }>;
export type GenreIndex = Map<string, string[]>;

// Wikidata genres are very specific ("action-adventure game", "soulslike", ...);
// fold them into a short list that is useful for browsing. Order = display order.
const GENRE_MAP: [string, string][] = [
  ["Action", String.raw`\baction\b|hack and slash|beat 'em up|soulslike|character action`],
  ["Adventure", String.raw`adventure|visual novel|interactive film|walking simulator`],
  ["RPG", String.raw`role-playing|\brpg\b|jrpg|dungeon crawl`],
  ["Shooter", String.raw`shooter|shoot 'em up|battle royale|\bfps\b`],
  ["Sports", String.raw`sports|football|soccer|basketball|cricket|golf|tennis|wrestling|boxing|hockey|baseball|` +
             String.raw`skateboard|snowboard|\bmma\b|mixed martial|olympic|cycling|volleyball`],
  ["Racing", String.raw`racing|driving|kart`],
  ["Fighting", String.raw`fighting|brawler`],
  ["Platformer", String.raw`platform|metroidvania`],
  ["Open World", String.raw`open world|sandbox`],
  ["Horror", String.raw`horror`],
  ["Survival", String.raw`survival`],
  ["Stealth", String.raw`stealth`],
  ["Strategy", String.raw`strategy|tactic|4x|tower defense|real-time tactics|grand strategy|card game|deck-building`],
  ["Simulation", String.raw`simulat|farming|management|city-building|god game|flight`],
  ["Puzzle", String.raw`puzzle|logic`],
  ["Roguelike", String.raw`roguelike|roguelite`],
  ["Party & Music", String.raw`party|music|rhythm|dance|trivia|board game`],
  ["Online / MMO", String.raw`massively multiplayer|\bmmo`],
];
const GENRE_RX = GENRE_MAP.map(([name, p]) => [name, rx(p)] as const);
const GENRE_ORDER = GENRE_MAP.map(([name]) => name);
const byGenreOrder = (a: string, b: string) => GENRE_ORDER.indexOf(a) - GENRE_ORDER.indexOf(b);

export function broadGenres(wikidataGenres: string[]): string[] {
  const found = new Set(GENRE_RX.filter(([, r]) => wikidataGenres.some((g) => r.test(g))).map(([name]) => name));
  return GENRE_ORDER.filter((name) => found.has(name));
}

export function buildGenreIndex(games: WikidataGames | null): GenreIndex {
  const index: GenreIndex = new Map();
  if (!games) return index;
  for (const g of Object.values(games)) {
    const genres = broadGenres(g.genres);
    if (!genres.length) continue;
    for (const name of [g.label, ...g.alts]) {
      const key = gameKey(cleanTitle(name));
      if (!key) continue;
      const current = index.get(key);
      if (!current) index.set(key, genres);
      else if (!sameList(current, genres) && name === g.label)
        index.set(key, [...new Set([...current, ...genres])].sort(byGenreOrder));
    }
  }
  return index;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// Last-resort hints for yearly franchises that stores abbreviate ("FC 25", "NHL 20").
const TITLE_HINTS: [RegExp, string[]][] = [
  [rx(String.raw`^(ea sports )?(fifa|fc|nba|nhl|madden|mlb|pga|ufc|wwe|pes|efootball|cricket|tennis|golf)\b`), ["Sports"]],
  [rx(String.raw`^(f1|motogp|wrc|dirt|nascar|need for speed|gran turismo|forza|crash team|ride)\b|racing|rally`), ["Racing"]],
  [rx(String.raw`^(call of duty|battlefield|doom|far cry|borderlands|destiny)\b`), ["Shooter"]],
  [rx(String.raw`^(dragon ?ball|mortal kombat|tekken|street fighter|naruto)\b`), ["Fighting"]],
];
const PREFIXES = ["marvels", "tom clancys", "sid meiers", "disney", "lego", "ea sports", "ea"];

/**
 * Exact title match first; then drop trailing words ("... Directors Cut", "... Remastered")
 * and a leading "marvels" / "tom clancys" etc. Good enough for genres, even if the
 * fallback lands on another entry of the same series.
 */
export function lookupGenres(key: string, index: GenreIndex): string[] {
  const exact = index.get(key);
  if (exact) return exact;
  for (const [r, genres] of TITLE_HINTS) if (r.test(key)) return genres;
  let words = key.split(" ").filter(Boolean);
  for (const prefix of PREFIXES) {
    const p = prefix.split(" ");
    const rest = words.slice(p.length).join(" ");
    if (words.slice(0, p.length).join(" ") === prefix && index.has(rest)) return index.get(rest)!;
  }
  while (words.length > 2) {
    words = words.slice(0, -1);
    const k = words.join(" ");
    if (k.length >= 8 && index.has(k)) return index.get(k)!;
  }
  return [];
}
