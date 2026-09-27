/**
 * Search text without accents, case or punctuation, so "spiderman" finds
 * "Spider-Man" and "ragnarok" finds "Ragnarök". Used for the stored index
 * and for the query, so both sides always normalize the same way.
 */
export const normalizeSearch = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
